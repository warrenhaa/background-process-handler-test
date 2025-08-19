const models = require('../models');
const {
    Op,
} = models.Sequelize;
const Logger = require('../Logger');
const {
    addActivityLog
} = require('./ActivityLogService');
const lodash = require('lodash');
const {
    Entities
} = require('../utils/Entities')
const { deviceProvison } = require('./deviceProvisionService');
const { cognitoLogin } = require('./UserService');

var getDevicesofLocation = function (location_id, company_id) {
    return new Promise((resolve, reject) => {
        models.devices.findAll({
            where: {
                location_id,
                company_id,
            },
            attributes: ['id', 'device_code', 'gateway_id', 'type'],
            raw: true,
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}
var DeleteRecordFromDynamoDB = function (obj) {
    return new Promise(async (resolve, reject) => {
        const adminemail = process.env.ADMIN_EMAIL;
        const password = process.env.ADMIN_PASSWORD;
        const AdminData = await cognitoLogin(
            { body: { company_id: obj.companyId } }, adminemail, password);

        const headerParams = {
            Authorization: AdminData.accessToken,
        };
        const userFormObj = {
            UserID: AdminData.identityId,
            Username: obj.input.Username,
            Command: obj.input.Command,
            DeviceID: obj.input.DeviceID
        };
        deviceProvison(headerParams, userFormObj, 0)
            .then(result => {
                resolve(result)
            }).catch(err => {
                reject(err)
            })
    })
}
var gatewayToLocation = function (gatewayList, companyId, jobId, userId) {
    return new Promise(async (resolve, reject) => {
        let count = 0
        let successList = []
        for (let element of gatewayList) {
            // find the device from the 'devices' table using device_code
            const getDevice = await models.devices.findOne({
                where: {
                    device_code: element.deviceCode,
                    company_id: companyId,
                },
                raw: true,
            })
            if (!getDevice) {

                addActivityLog(Entities.importGatewayLocations.entity_name, Entities.importGatewayLocations.event_name.job, element.deviceCode, `Device Not Found`, jobId, companyId)
            }

            // find the location from the 'locations' table using path 
            const locations = await models.locations.findOne({
                where: {
                    path: {
                        breadcrumb: element.path
                    },
                    name: element.locationName
                },
                raw: true,
            })
            if (!locations) {
                addActivityLog(Entities.importGatewayLocations.entity_name, Entities.importGatewayLocations.event_name.job, element.path, `Location Not Found`, jobId, companyId)
            }
            if (getDevice && locations) {
                // get the gateway and devices linked to the gateway using id and gateway_id  before updating the location
                const oldGateways = await models.devices.findAll({
                    include: [{
                        model: models.locations,
                        required: true,
                        as: 'locations',
                    },],
                    where: {

                        [Op.or]: [{
                            id: getDevice.id
                        },
                        {
                            gateway_id: getDevice.id
                        }
                        ]
                    },
                    raw: true,
                });
                const updateFields = {
                    location_id: locations.id,
                    id: getDevice.id,
                    updated_by: userId,
                    updated_at: new Date()
                }
                //  query for updating the location for gateway and devices linked to the gateway.
                const queryStr = "UPDATE devices SET location_id= :location_id,updated_by= :updated_by,updated_at= :updated_at where id in (:id) OR gateway_id in (:id)"
                const [results, metadata] = await models.sequelize.query(queryStr, {
                    raw: true,
                    replacements: updateFields,
                    logging: console.log,
                }).catch(() => {
                    addActivityLog(Entities.importGatewayLocations.entity_name, Entities.importGatewayLocations.event_name.job, element, `Device Not Linked`, jobId, companyId)
                })
                // get the gateway and devices linked to the gateway using id and gateway_id  after updating the location
                const newGateways = await models.devices.findAll({
                    include: [{
                        model: models.locations,
                        required: true,
                        as: 'locations',
                    },],
                    where: {
                        [Op.or]: [{
                            id: getDevice.id
                        },
                        {
                            gateway_id: getDevice.id
                        }
                        ]
                    },
                    raw: true,
                });
                for (let element of oldGateways) {
                    const old_obj = element;
                    const new_obj = lodash.find(newGateways, {
                        id: element.id
                    });
                    const device_obj = {
                        old: old_obj,
                        new: new_obj,
                    };
                    const unlink_obj = {
                        old: old_obj,
                        new: {}
                    };
                    const link_obj = {
                        old: {},
                        new: new_obj,
                    };
                    if (old_obj.location_id && old_obj.location_id !== new_obj.location_id) {
                        addActivityLog(Entities.locations.entity_name, Entities.locations.event_name.unlinked, unlink_obj, 'Existing Record Updated By Job', old_obj.location_id, companyId)
                        addActivityLog(Entities.locations.entity_name, Entities.locations.event_name.linked, link_obj, 'Existing Record Updated By Job', new_obj.location_id, companyId)
                    } else {
                        addActivityLog(Entities.locations.entity_name, Entities.locations.event_name.linked, link_obj, 'Existing Record Updated By Job', new_obj.location_id, companyId)
                    }

                    if (new_obj.type === 'gateway') {
                        addActivityLog(Entities.devices.entity_name, Entities.devices.event_name.location_updated, device_obj, 'Existing Record Updated By Job', new_obj.id, companyId)
                        addActivityLog(Entities.importGatewayLocations.entity_name, Entities.importGatewayLocations.event_name.job, new_obj, 'Gateway Location Linked', jobId, companyId)
                    } else {
                        addActivityLog(Entities.devices.entity_name, Entities.devices.event_name.location_updated, device_obj, 'Existing Record Updated By Job', new_obj.id, companyId)
                        addActivityLog(Entities.importGatewayLocations.entity_name, Entities.importGatewayLocations.event_name.job, new_obj, 'Device Location Linked', jobId, companyId)
                    }
                }
                successList.push(newGateways)
                count = count + 1
                if (count == gatewayList.length) {
                    resolve(successList)
                }
            } else {
                count = count + 1
                if (count == gatewayList.length) {
                    resolve(successList)
                }
            }
        }
    })
}

var linkGatewayLocation = function (obj) {
    return new Promise(async (resolve, reject) => {
        const gatewayList = JSON.parse(obj.input.gatewayList)
        const jobId = obj.jobId
        const companyId = obj.companyId
        const userId = obj.input.userId
        const devices = await gatewayToLocation(gatewayList, companyId, jobId, userId)
        const successCount = devices.length
        const errorCount = gatewayList.length - successCount
        addActivityLog(Entities.importGatewayLocations.entity_name, Entities.importGatewayLocations.event_name.job, {
            FailedCount: errorCount,
            SuccessCount: successCount,
            TotalCount: gatewayList.length
        }, `Out of ${gatewayList.length} records, ${successCount} has been linked to the location and ${errorCount} has failed to linked to the location.`, jobId, companyId)
        resolve()
    })
}

let deleteDeviceEvents = function ( obj) {
    return new Promise(async (resolve, reject) => {
        let {jobId, company_id} = obj
        let { device_code, deleted_at, retry_count } = obj?.input
        let limit = process.env.DEVICE_EVENTS_DELETE_LIMIT||100000
        addActivityLog(Entities.deleteDeviceEvent.entity_name, Entities.deleteDeviceEvent.event_name.job, obj, "Deleting device events for device started with retry count.", jobId, company_id)
        await models.device_events.destroy({
            where: {
                device_code: device_code,
                event_at: {
                    [Op.lt]: deleted_at
                }
            },
            limit,
        }).then(async (result) => {
            if (result == 0 || result < limit) {
                addActivityLog(Entities.deleteDeviceEvent.entity_name, Entities.deleteDeviceEvent.event_name.device_event_delete, obj, "All device events deleted.", jobId, company_id)
                resolve(result);
            } else {
                retry_count++
                addActivityLog(Entities.deleteDeviceEvent.entity_name, Entities.deleteDeviceEvent.event_name.job, obj, "Device events deleting as exceeded limit.", jobId, company_id)
                await deleteDeviceEvents( obj).then(result => {
                    resolve(result)
                }).catch(err => {
                    reject(err)
                })
            }
            resolve(result);
        }).catch(err => {
            addActivityLog(Entities.deleteDeviceEvent.entity_name, Entities.deleteDeviceEvent.event_name.job, err, "Error while deleting Device events.", jobId, company_id)
            reject(err);
        });
    })
}


module.exports = {
    getDevicesofLocation,
    linkGatewayLocation,
    DeleteRecordFromDynamoDB,
    deleteDeviceEvents
}