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
} = require('./ActivityLogService');
const {
    Constant
} = require('../Constants')
const {
    getFromTable,
    addToTable
} = require('../dynamodb');
const {
    Entities
} = require('../utils/Entities')
const {
    v4: uuidv4,
} = require('uuid');
const Logger = require('../Logger');
const mudder = require('mudder'); // only in Node
const { sleep } = require('../Helper')
const { cognitoLogin } = require('./UserService');


const getOccupantsDashboardAttributes = function (occupant_id, company_id, item_id) {
    return new Promise(async (resolve, reject) => {
        let where = { occupant_id, company_id, item_id }
        models.occupants_dashboard_attributes.findOne({
            attributes: ['id', 'type', 'grid_order'],
            where
        }).then((result) => {
            resolve(result);
        }).catch((err) => {
            reject(err);
        });
    })
}

const getRandomGridOrder = function () {
    return new Promise(async (resolve, reject) => {
        var hex = new mudder.SymbolTable('0123456789abcdef');
        var hexstrings = hex.mudder('0', 'f', 10000);
        const random = Math.floor(Math.random() * hexstrings.length)
        resolve(random);
        return random;

    })
}

const addOrUpdateDashboardAttributes = function (dashboardAttributeObj, occupantId, jobId, companyId, locationId) {
    return new Promise(async (resolve, reject) => {
        const item_id = locationId;
        const dashboardAttributes = await getOccupantsDashboardAttributes(occupantId, companyId, item_id)
        if (!dashboardAttributes) {
            let addDashboardAttributes = await models.occupants_dashboard_attributes.create(dashboardAttributeObj)
                .catch((err) => {
                    reject(err)
                });
            const obj = {
                old: {},
                new: addDashboardAttributes,
            };
            addActivityLog(Entities.locationCheckIn.entity_name, Entities.locationCheckIn.event_name.added, obj, "Occupant dashboard attributes created", jobId, companyId)
            let dashboardAttributes = await getOccupantsDashboardAttributes(occupantId, companyId, item_id)
            resolve();
            return dashboardAttributes
        } else {
            await models.occupants_dashboard_attributes.update(
                { grid_order: dashboardAttributeObj.grid_order },
                {
                    where: {
                        occupant_id: occupantId, company_id: companyId, item_id,
                    }, returning: true
                }).catch((error) => {
                    reject(error)
                });
            let oldObj = { grid_order: dashboardAttributes.grid_order };
            let newObj = { grid_order: dashboardAttributeObj.grid_order };
            const obj = {
                old: oldObj,
                new: newObj,
            };
            addActivityLog(Entities.locationCheckIn.entity_name, Entities.locationCheckIn.event_name.updated, obj, "Occupant dashboard attributes updated.", jobId, companyId)
            let dashboardAttributesobj = await getOccupantsDashboardAttributes(occupantId, companyId, item_id);
            resolve();
            return dashboardAttributesobj
        }
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
        const locationId = obj.input.locationId
        const jobId = obj.jobId
        const userIdentityId = obj.input.userIdentityId
        const adminIdentityId = AdminData.identityId
        // obj.input.adminIdentityId
        const userName = obj.input.userName
        const authorisation = AdminData.accessToken
        // obj.input.authorization
        const adminEmail = obj.input.adminEmail;
        const headerParams = {
            Authorization: authorisation,
        };
        let key = 'constants'
        let constants = await Constant(key);
        const userFormObj = {
            UserID: userIdentityId,
            Username: userName,
            Command: constants.DeviceProvision.CREATE_USER_RECORD
        };
        addActivityLog(Entities.locationCheckIn.entity_name, Entities.locationCheckIn.event_name.job, obj, "Job processing started.", jobId, companyId)

        //checking user is authenticated or not 
        addActivityLog(Entities.locationCheckIn.entity_name, Entities.locationCheckIn.event_name.job, obj, "Checking user is authentication.", jobId, companyId)
        deviceProvison(headerParams, userFormObj, 0)
            .then(result => {
                //getting all devices of that location
                addActivityLog(Entities.locationCheckIn.entity_name, Entities.locationCheckIn.event_name.job, obj, "User is autherised.", jobId, companyId)
                addActivityLog(Entities.locationCheckIn.entity_name, Entities.locationCheckIn.event_name.job, obj, "Getting all devices of given location.", jobId, companyId)
                getDevicesofLocation(locationId, companyId)
                    .then(async (devices) => {
                        if (devices && devices.length > 0) {
                            addActivityLog(Entities.locationCheckIn.entity_name, Entities.locationCheckIn.event_name.job, {
                                count: devices.length
                            }, "Found devices, started device provisioned.", jobId, companyId)
                            var accessGivenDevices = []
                            for (let key in devices) {
                                const device = devices[key]
                                const deviceCode = device.device_code
                                const deviceId = device.id
                                const deviceFormObj = {
                                    UserID: adminIdentityId,
                                    Username: userName,
                                    DeviceID: deviceCode,
                                    Command: constants.DeviceProvision.SHARE_DEVICE_BY_OWNER
                                };
                                // checking gateway id for the device. if it is not null then only giving device provision.
                                if (device.gateway_id !== null && device.type != 'coordinator_device') {
                                    // getting the device code of the getway.
                                    const Gateway = await models.devices.findOne({
                                        where: {
                                            id: device.gateway_id,
                                        },
                                        attributes: ['device_code',],
                                        raw: true,
                                    }).then(result => {
                                        return result;
                                    }).catch(err => {
                                        Logger.error("Error ", { "error": err.stack })
                                    })
                                    const GatewayID = Gateway.device_code;
                                    await sleep(5000)
                                    await deviceProvison(headerParams, deviceFormObj, 0)
                                        .then((result) => {
                                            var data = result.data
                                            if (data.errorMessage) {
                                                addActivityLog(Entities.locationCheckIn.entity_name, Entities.locationCheckIn.event_name.job, {
                                                    device_code: deviceCode
                                                }, data.errorMessage, jobId, companyId)
                                                var accessDeviceListString = ''
                                                accessGivenDevices.forEach(element => {

                                                    accessDeviceListString = accessDeviceListString + element + ','
                                                });
                                                var message = "Occupant check in job got failed, for the following devices occupant got access ," + accessDeviceListString
                                                if (accessGivenDevices.length == 0) {
                                                    message = "Occupant check in job got failed,  occuapnt not got any access for devices"
                                                }
                                                const placeholdersData = {
                                                    receiverList: [{ email: adminEmail }],
                                                    message,
                                                    entity: Entities.locationCheckIn.entity_name,
                                                    job: "Occupant check in job"
                                                };
                                                addActivityLog(Entities.locationCheckIn.entity_name, Entities.locationCheckIn.event_name.job_error, {
                                                    device_code: deviceCode
                                                }, data.errorMessage, jobId, companyId, placeholdersData)
                                                reject(data)
                                            } else {
                                                accessGivenDevices.push(deviceCode)
                                                addActivityLog(Entities.locationCheckIn.entity_name, Entities.locationCheckIn.event_name.job, {
                                                    device_code: deviceCode
                                                }, data.body, jobId, companyId)
                                                return result
                                            }

                                        })
                                        .catch(err => {
                                            addActivityLog(Entities.locationCheckIn.entity_name, Entities.locationCheckIn.event_name.job, {
                                                device_code: deviceCode
                                            }, err.message, jobId, companyId)
                                        })
                                    //add record in postgres occupants_dashboard_attributes tableName
                                    let grid_order = await getRandomGridOrder();
                                    let dashboardAttributeObj = {
                                        item_id: deviceId, type: 'device', grid_order, occupant_id: occupantId, company_id: companyId,
                                    };
                                    await addOrUpdateDashboardAttributes(dashboardAttributeObj, occupantId, jobId, companyId, locationId).catch((err) => {
                                        Logger.error("Error ", { "error": err.stack })
                                    })
                                } else {
                                    addActivityLog(Entities.locationCheckIn.entity_name, Entities.locationCheckIn.event_name.job, deviceCode, "No gateway found for this device.", jobId, companyId)
                                }
                                if (key == devices.length - 1) {
                                    resolve(result)
                                }
                            };
                        } else {
                            resolve()
                            addActivityLog(Entities.locationCheckIn.entity_name, Entities.locationCheckIn.event_name.job, obj, "No devices found for this location.", jobId, companyId)
                        }
                    }).catch(err => {
                        reject(err)
                    })
            }).catch(err => {
                resolve()
                addActivityLog(Entities.locationCheckIn.entity_name, Entities.locationCheckIn.event_name.job, obj, err.message, jobId, companyId)
            })
    })
}
module.exports = {
    manage, getRandomGridOrder, addOrUpdateDashboardAttributes
}
