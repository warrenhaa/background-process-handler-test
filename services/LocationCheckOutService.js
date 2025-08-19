const models = require('../models');
const {
    Op
} = models.Sequelize;
const {
    getDevicesofLocation
} = require('./deviceService');
const {
    deviceProvison
} = require('./deviceProvisionService');
const {
    addActivityLog
} = require('./ActivityLogService')
const {
    Entities
} = require('../utils/Entities')
const {
    Constant
} = require('../Constants');
const {
    forEach
} = require('lodash');
const {
    getFromTable,
    deleteFromTable,
} = require('../dynamodb');
const Logger = require('../Logger');
const { sleep } = require('../Helper')
const { cognitoLogin } = require('./UserService');


function deleteOccupantsGroupsData(locationId, occupantId, occupants_group_type, companyId, jobId) {
    return new Promise(async (resolve, reject) => {
        let where = {
            item_id: locationId,
            occupant_id: occupantId,
            type: occupants_group_type,
            company_id: companyId,
        };
        const findAllGroups = await models.occupants_groups.findAll({
            where
        }).catch((err) => {
            reject(err);
        })
        if (findAllGroups && findAllGroups.length > 0) {
            findAllGroups.forEach(async (element) => {
                let dashboardAttributeObj = {
                    item_id: element.id, type: 'group', occupant_id: occupantId, company_id: companyId,
                };
                await deleteOccupantsDashboardAttributes(dashboardAttributeObj, jobId, companyId)
                    .catch((err) => {
                        reject(err);
                    });

                models.occupants_groups.destroy({
                    where: { id: element.id }
                }).then((result) => {
                    if (result > 0) {
                        addActivityLog(Entities.locationCheckOut.entity_name, Entities.locationCheckOut.event_name.group_deleted, where, "Occupant Group deleted", jobId, companyId)
                    }
                    resolve(result);
                }).catch((err) => {
                    addActivityLog(Entities.locationCheckOut.entity_name, Entities.locationCheckOut.event_name.group_deleted, where, "Occupant Group not deleted", jobId, companyId)
                    reject(err);
                });
            });
        } else {
            resolve([])
        }
    })
}

function LocationCheckOut(locationId, occupantId, update) {
    return new Promise(async (resolve, reject) => {
        await models.occupants_locations.update(update, {
            where: {
                location_id: locationId,
                occupant_id: occupantId,
            },
        })
        await models.occupants_locations.findOne({
            where: {
                occupant_id: occupantId,
                location_id: locationId,
            }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

function GatewayCode(id) {
    return new Promise(async (resolve, reject) => {
        models.devices.findOne({
            where: {
                id,
            },
            attributes: ['device_code',],
            raw: true,
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

const deleteOccupantsDashboardAttributes = function (dashboardAttributeObj, jobId, companyId) {
    return new Promise(async (resolve, reject) => {
        let where = {
            occupant_id: dashboardAttributeObj.occupant_id,
            company_id: dashboardAttributeObj.company_id,
            item_id: dashboardAttributeObj.item_id,
            type: dashboardAttributeObj.type,
        }
        await models.occupants_dashboard_attributes.destroy({
            where
        }).then((result) => {
            if (result > 0) {
                addActivityLog(Entities.locationCheckOut.entity_name, Entities.locationCheckOut.event_name.deleted, where, "Occupant dashboard attributes deleted", jobId, companyId)
            }
            resolve(result);
        }).catch((err) => {

            addActivityLog(Entities.locationCheckOut.entity_name, Entities.locationCheckOut.event_name.deleted, where, "Occupant dashboard attributes not deleted", jobId, companyId)
            reject(err);
        });
    })
}

const manage = function (obj) {
    return new Promise(async (resolve, reject) => {

        const companyId = obj.companyId
        const email = process.env.ADMIN_EMAIL;
        const password = process.env.ADMIN_PASSWORD;
        const reqObj = {
            body: {
                company_id: companyId
            }
        }
        const AdminData = await cognitoLogin(reqObj, email, password).catch(error => { reject(error) });
        if (!AdminData) {
            // Logger.info("_AdminData", "AdminData Not Found");
            reject({ message: "AdminData Not Found" });
        }
        const occupantId = obj.input.occupantId
        const userId = obj.input.userId
        const update = { status: 'checked out', check_out_by: userId, check_out_at: new Date() };
        const locationId = obj.input.locationId
        const jobId = obj.jobId
        const userIdentityId = obj.input.userIdentityId
        const adminIdentityId = AdminData.identityId;
        // obj.input.adminIdentityId
        const userName = obj.input.userName
        const authorisation = AdminData.accessToken;
        // obj.input.authorization
        
        let key = 'constants'
        let constants = await Constant(key);
        const headerParams = {
            'x-company-code': companyId,
            Authorization: authorisation,
        };
        const userFormObj = {
            UserID: userIdentityId,
            Username: userName,
            Command: constants.DeviceProvision.CREATE_USER_RECORD
        };
        addActivityLog(Entities.locationCheckOut.entity_name, Entities.locationCheckOut.event_name.job, obj, "Job processing started.", jobId, companyId)
        await LocationCheckOut(locationId, occupantId, update).catch(error => { reject(error) });
        let dashboardAttributeObj = {
            item_id: locationId, type: 'location', occupant_id: occupantId, company_id: companyId,
        };
        const occupants_group_type = 'location';
        await deleteOccupantsGroupsData(locationId, occupantId, occupants_group_type, companyId, jobId)
            .catch((err) => {
                reject(err);
            });

        await deleteOccupantsDashboardAttributes(dashboardAttributeObj, jobId, companyId,)
            .catch((err) => {
                reject(err);
            });
        //checking user is authenticated or not 
        addActivityLog(Entities.locationCheckOut.entity_name, Entities.locationCheckOut.event_name.job, obj, "Checking user is authentication.", jobId, companyId)
        await deviceProvison(headerParams, userFormObj, 0)
            .then(async (result) => {
                //getting all devices of that location
                addActivityLog(Entities.locationCheckOut.entity_name, Entities.locationCheckOut.event_name.job, obj, "User is autherised.", jobId, companyId)
                addActivityLog(Entities.locationCheckOut.entity_name, Entities.locationCheckOut.event_name.job, obj, "Getting all devices of given location.", jobId, companyId)
                getDevicesofLocation(locationId, companyId)
                    .then(async (devices) => {
                        if (devices && devices.length > 0) {
                            addActivityLog(Entities.locationCheckOut.entity_name, Entities.locationCheckOut.event_name.job, {
                                count: devices.length
                            }, "Found devices, started device provisioned.", jobId, companyId)
                            let occupantGateways = [];
                            // getting the list of the locations to which occupant has checked in
                            occupantLocations = await models.occupants_locations.findAll({
                                where: {
                                    occupant_id: occupantId,
                                    status: 'checked in'
                                }
                            }).catch(err => {
                                reject(err)
                            })
                            // getting the list of gateways linked to the each locations to which occupant has checked in
                            for (let key in occupantLocations) {
                                const locations = occupantLocations[key]
                                if (locationId !== locations.location_id) {
                                    const occupantLocationsDevices = await getDevicesofLocation(locations.location_id, companyId)
                                    for (let key in occupantLocationsDevices) {
                                        const gateways = occupantLocationsDevices[key]
                                        if (gateways.gateway_id !== null) {
                                            const GatewayObj = await GatewayCode(gateways.gateway_id)
                                                .then(result => {
                                                    return result;
                                                }).catch(err => {
                                                    reject(err)
                                                })
                                            const isInArray = occupantGateways.includes(GatewayObj.device_code);
                                            if (!isInArray) {
                                                await occupantGateways.push(GatewayObj.device_code)
                                            }
                                        }
                                    }
                                }
                            }
                            for (let key in devices) {
                                const device = devices[key]
                                const deviceCode = device.device_code
                                const deviceId = device.id
                                const deviceFormObj = {
                                    UserID: adminIdentityId,
                                    Username: userName,
                                    DeviceID: deviceCode,
                                    Command: constants.DeviceProvision.REMOVE_SHARE_DEVICE_BY_OWNER
                                };
                                if (device.gateway_id !== null) {
                                    await sleep(5000)
                                    deviceProvison(headerParams, deviceFormObj, 0)
                                        .then(result => {
                                            var data = result.data
                                            addActivityLog(Entities.locationCheckOut.entity_name, Entities.locationCheckOut.event_name.job, {
                                                device_code: deviceCode
                                            }, data.body, jobId, companyId)
                                            if (key == devices.length - 1) {
                                                resolve(result)
                                            }
                                        })
                                        .catch(err => {
                                            addActivityLog(Entities.locationCheckOut.entity_name, Entities.locationCheckOut.event_name.job, {
                                                device_code: deviceCode
                                            }, err.message, jobId, companyId)
                                            if (key == devices.length - 1) {
                                                resolve()
                                            }
                                        })
                                    let dashboardAttributeObj = {
                                        item_id: deviceId, type: 'device', occupant_id: occupantId, company_id: companyId,
                                    };
                                    await deleteOccupantsDashboardAttributes(dashboardAttributeObj, jobId, companyId)
                                        .catch((err) => {
                                            Logger.error("Error ", { "error": err.stack })
                                        });
                                    // Getting the deviceCode of the gateway
                                    let deviceGatewayCode = await GatewayCode(device.gateway_id)
                                        .then(result => {
                                            return result;
                                        }).catch(err => {
                                            Logger.error("Error ", { "error": err.stack })
                                        })
                                    const GatewayID = deviceGatewayCode.device_code;
                                    let checkGateway = occupantGateways.includes(GatewayID);
                                    /* if Gateway is linked to the another location to which occupant has checked in then we are not 
                                     removing the gateway from the two Table namely UsersAndPermissions-New table and UserGatewayAttributes-New table*/
                                    if (!checkGateway) {
                                        // occupantGateways.push(GatewayID)
                                    }
                                } else {
                                    addActivityLog(Entities.locationCheckOut.entity_name, Entities.locationCheckOut.event_name.job, deviceCode, "No gateway found for this device.", jobId, companyId)
                                }
                                if (key == devices.length - 1) {
                                    resolve(result)
                                }
                            };
                        } else {
                            resolve()
                            addActivityLog(Entities.locationCheckOut.entity_name, Entities.locationCheckOut.event_name.job, obj, "No devices found for this location.", jobId, companyId)
                        }
                    }).catch(err => {
                        reject(err)
                    })
            }).catch(err => {
                resolve()
                addActivityLog(Entities.locationCheckOut.entity_name, Entities.locationCheckOut.event_name.job, obj, err.message, jobId, companyId)
            })
    })
}

module.exports = {
    manage
}
