const models = require('../models');
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
    Entities
} = require('../utils/Entities')
const locationCheckInService = require('./LocationCheckInService');

const Logger = require('../Logger');

var manage = function(obj) {
    return new Promise(async (resolve, reject) => {
        const locationId = obj.input.locationId;
        const ids = obj.input.ids;
        const companyId = obj.companyId
        const jobId = obj.jobId
        const occupantsCheckinList = await models.occupants_locations.findAll({
            include: [{
                model: models.occupants,
                required: true,
            }, ],
            where: {
                location_id: locationId,
                status: 'checked in',
            },
        });
        // find all the devices assigned to room location
        const devicesLinked = await models.devices.findAll({
            where: {
                id: [...ids],
                location_id: locationId,
                company_id: companyId,
            },
        });
        let occupant_id = null;
        let occupant_email = null;
        const identity_id = obj.input.adminIdentityId;
        const accessToken = obj.input.accessToken;
        // call to device provision api to give access to occupants checkins
        // if occupants are assigned to the location only then enter for loop 

        if (occupantsCheckinList.length > 0) {
            let key = 'constants'
            let constants = await Constant(key);
            addActivityLog(Entities.shareDeviceToOccupants.entity_name, Entities.shareDeviceToOccupants.event_name.job, {
                                count: occupantsCheckinList.length
            }, "Found Occupants,", jobId, companyId)
            if (devicesLinked.length > 0) {
                for (let item in occupantsCheckinList) {
                    const element = occupantsCheckinList[item];
                    if (element.occupant.id != null) {
                        occupant_id = element.occupant.id;
                        occupant_email = element.occupant.email;

                        for (let ele in devicesLinked) { 
                            const deviceData = devicesLinked[ele];
                            const headerParams = {
                                Authorization: accessToken,
                            };
                            if (deviceData.type === 'gateway') {
                                let gatewaysDevices = await models.devices.findAll({
                                    where: { 
                                        gateway_id: deviceData.id,
                                    },
                                    raw: true,
                                });
                                if (gatewaysDevices && gatewaysDevices.length > 0) {
                                    addActivityLog(Entities.shareDeviceToOccupants.entity_name, Entities.shareDeviceToOccupants.event_name.job, {
                                    count: gatewaysDevices.length
                                    }, "Found devices for the gateway, started device provision.", jobId, companyId)
                                    for (let element in gatewaysDevices) {
                                        let device = gatewaysDevices[element];
                                        const deviceFormObj = {
                                            UserID: identity_id,
                                            Username: occupant_email,
                                            Command: constants.DeviceProvision.SHARE_DEVICE_BY_OWNER,
                                            DeviceID: device.device_code,
                                        };
                                       // deviceFormObj.occupantId = occupant_id;
                                        await deviceProvison(headerParams, deviceFormObj, 0)
                                            .then((result) => {
                                                const {
                                                    data
                                                } = result;
                                                if (data.errorMessage) {
                                                    addActivityLog(Entities.shareDeviceToOccupants.entity_name, Entities.shareDeviceToOccupants.event_name.job, data.errorMessage, "Device shared to occupant failed.", jobId, companyId)
                                                    Logger.error("Error ", {
                                                        "error": data.errorMessage
                                                    })
                                                } else if (data.statusCode != 200) {
                                                    deviceFormObj.occupantId = occupant_id;
                                                    addActivityLog(Entities.shareDeviceToOccupants.entity_name, Entities.shareDeviceToOccupants.event_name.job, {data, deviceFormObj}, "Device shared to occupant failed.", jobId, companyId)
                                                    Logger.error("Error ", {
                                                        "error": data.statusCode
                                                    })
                                                } else if (data.statusCode == 200) {
                                                    deviceFormObj.occupantId = occupant_id;
                                                    addActivityLog(Entities.shareDeviceToOccupants.entity_name, Entities.shareDeviceToOccupants.event_name.job, {data, deviceFormObj}, "Device shared to occupant successfully.", jobId, companyId)
                                                    Logger.error("Error ", {
                                                        "error": data.statusCode
                                                    })
                                                }
                                            })
                                            .catch((error) => {
                                                addActivityLog(Entities.shareDeviceToOccupants.entity_name, Entities.shareDeviceToOccupants.event_name.job, error, "Device shared to occupant failed.", jobId, companyId)
                                                Logger.error("Error ", {
                                                    "error": error.stack
                                                })
                                            })
                                         //add record in postgres occupants_dashboard_attributes tableName
                                    let grid_order = await locationCheckInService.getRandomGridOrder();
                                    let dashboardAttributeObj = {
                                        item_id: device.id, type: 'device', grid_order, occupant_id, company_id: companyId,
                                    };
                                    await locationCheckInService.addOrUpdateDashboardAttributes(dashboardAttributeObj, occupant_id, jobId, companyId, locationId).catch((err) => {
                                        Logger.error("Error ", { "error": err.stack })
                                    })
                                    }
                                }
                            }
                            let deviceCode = deviceData.device_code.split('-')
                            if (deviceCode.length > 2) {
                                addActivityLog(Entities.shareDeviceToOccupants.entity_name, Entities.shareDeviceToOccupants.event_name.job, {
                                count: devicesLinked.length
            }, "Found devices, started device provision.", jobId, companyId)
                                const deviceFormObj = {
                                    UserID: identity_id,
                                    Username: occupant_email,
                                    Command: constants.DeviceProvision.SHARE_DEVICE_BY_OWNER,
                                    DeviceID: deviceData.device_code,
                                };
                                //deviceFormObj.occupantId = occupant_id;
                                await deviceProvison(headerParams, deviceFormObj, 0)
                                    .then((result) => {
                                        const {
                                            data
                                        } = result;
                                         if (data.errorMessage) {
                                            addActivityLog(Entities.shareDeviceToOccupants.entity_name, Entities.shareDeviceToOccupants.event_name.job, data.errorMessage, "Device shared to occupant failed.", jobId, companyId)
                                            Logger.error("Error ", {
                                                "error": data.errorMessage
                                            })
                                        } else if (data.statusCode != 200) {
                                            addActivityLog(Entities.shareDeviceToOccupants.entity_name, Entities.shareDeviceToOccupants.event_name.job, {data, deviceFormObj}, "Device shared to occupant failed.", jobId, companyId)
                                            Logger.error("Error ", {
                                                "error": data.statusCode
                                            })
                                        } else if (data.statusCode == 200) {
                                                    deviceFormObj.occupantId = occupant_id;
                                                    addActivityLog(Entities.shareDeviceToOccupants.entity_name, Entities.shareDeviceToOccupants.event_name.job, {data, deviceFormObj}, "Device shared to occupant successfully.", jobId, companyId)
                                                    Logger.error("Error ", {
                                                        "error": data.statusCode
                                                    })
                                                }
                                    })
                                    .catch((error) => {
                                        addActivityLog(Entities.shareDeviceToOccupants.entity_name, Entities.shareDeviceToOccupants.event_name.job, error, "Device shared to occupant failed.", jobId, companyId)
                                        Logger.error("Error ", {
                                            "error": error.stack
                                        })
                                    })
                                //add record in postgres occupants_dashboard_attributes tableName
                                    let grid_order = await locationCheckInService.getRandomGridOrder();
                                    let dashboardAttributeObj = {
                                        item_id: deviceData.id, type: 'device', grid_order, occupant_id, company_id: companyId,
                                    };
                                    await locationCheckInService.addOrUpdateDashboardAttributes(dashboardAttributeObj, occupant_id, jobId, companyId, locationId).catch((err) => {
                                        Logger.error("Error ", { "error": err.stack })
                                    })
                            }
                        }
                    }
                    if (item == occupantsCheckinList.length - 1) {
                        resolve()
                    }
                }
            }
            else {
            resolve()
            addActivityLog(Entities.shareDeviceToOccupants.entity_name, Entities.shareDeviceToOccupants.event_name.job, obj, "No devices found for this location.", jobId, companyId)
        }

        } else {
            resolve()
            addActivityLog(Entities.shareDeviceToOccupants.entity_name, Entities.shareDeviceToOccupants.event_name.job, obj, "No occupants found for this location.", jobId, companyId)
        }
    })
}
module.exports = {
    manage
}