const { Entities } = require('../utils/Entities');
const models = require('../models');
const lodash = require('lodash');
const { createJob, updateJob } = require('../services/JobsService')
const { Op } = models.Sequelize;
const Logger = require('../Logger');
const { setInCache, deleteFromCache, deleteFromCacheUsingKey } = require('../cache/Cache');
const { getFromTable, addToTable, deleteFromTable } = require('../dynamodb');
let { deleteActivityLogs, deleteMultipleActivityLogs, addActivityLog } = require('../services/ActivityLogService');
const { publishJsonUrl, publishSyncBlockProperty } = require('../services/CommunicateWithAwsIotService');
const { executeQuery } = require('../redshift/config')
const { getCompany } = require('../cache/Companies');
const CommunicateWithAwsIotService = require('../services/CommunicateWithAwsIotService');
const moment = require('moment');
const categoryb_models = require('../categoryb_models');
const genericJobQueue = require('../sqs/GenericJobQueueProducer');

//check device or gateway exists
var checkDeviceOrGatewayExists = function (device_code, company_id) {
    return new Promise((resolve, reject) => {
        models.devices.findOne({
            where: {
                device_code
            }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}
//get all devices for gateways
var getAllGatewayDevices = function (gateway_id) {
    return new Promise((resolve, reject) => {
        models.devices.findAll({
            where: {
                gateway_id
            }
        }).then(result => {

            var deviceCodeLists = [];
            var deviceIdLists = [];

            if (result && result.length > 0) {
                result.forEach((element, index) => {
                    deviceCodeLists.push(element.device_code)
                    deviceIdLists.push(element.id)
                    if (index == (result.length - 1)) {
                        resolve({
                            deviceCodeLists: deviceCodeLists,
                            deviceIdLists: deviceIdLists,
                            result: result
                        })
                    }
                });

            } else {
                resolve(result)
            }

        }).catch(err => {
            reject(err)
        })
    })
}
// var job = {
//     id, type, status, input, company_id, created_at, updated_at
// }

// var activity_logs = {
//     entity_id = job_id,
//     entity, event_name, data, company_id, created_at, updated_at
// }

//delete device from dynamo db


//delete Alerts
//not implemented yet
//......

//delete Device
var deleteDeviceOrGateway = function (id) {
    return new Promise((resolve, reject) => {
        models.devices.destroy({
            where: {
                id
            }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

// var deleteDeviceStatusHistories = function (deviceCode, company_id) {
//     return new Promise((resolve, reject) => {
//         models.device_status_histories.destroy({
//             where: {
//                 'device.device_code': {
//                     [Op.iLike]: deviceCode,
//                 }, company_id
//             }
//         }).then(result => {
//             resolve(result)
//         }).catch(err => {
//             reject(err)
//         })
//     })
// }

// delete record from schedules
var deleteDeviceSchedules = function (device_id, company_id) {
    return new Promise((resolve, reject) => {
        models.schedules.destroy({
            where: { device_id, company_id }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

// delete record from device_references
var deleteDeviceReferences = function (device_id) {
    return new Promise((resolve, reject) => {
        models.device_references.destroy({
            where: { device_id }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

//find single controls and its devices for manageGateway
var getGatewaySingleControlAndDevice = function (gateway_id) {
    return new Promise((resolve, reject) => {
        models.single_controls.findAll({
            where: { gateway_id: gateway_id },
            include: [{
                model: models.single_control_devices,
            },
            ],
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

//find single controls and its devices for managedevice
var getSingleControlAndDevice = function (device_id) {
    return new Promise((resolve, reject) => {
        models.single_controls.findOne({
            where: { default_device_id: device_id },
            include: [{
                model: models.single_control_devices,
            },
            ],
            order: [
                [models.single_control_devices, 'created_at', 'asc'],
            ]
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

//find single_control_devices
var getSingleControlDevice = function (device_id) {
    return new Promise((resolve, reject) => {
        models.single_control_devices.findOne({
            where: { device_id: device_id }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

//delete single_control_devices
var deleteSingleControlDevice = function (device_id) {
    return new Promise((resolve, reject) => {
        models.single_control_devices.destroy({
            where: { device_id: device_id }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

//delete single_control_devices for Gateway
var deleteSingleControlDevice_on_id = function (device_id, single_control_id) {
    return new Promise((resolve, reject) => {
        models.single_control_devices.destroy({
            where: { device_id: device_id, single_control_id: single_control_id }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

//delete single_controls
var deleteSingleControl = function (id, device_id) {
    return new Promise((resolve, reject) => {
        models.single_controls.destroy({
            where: { id: id, default_device_id: device_id }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

//delete single_controls for Gateway
var deleteSingleControl_Gateway = function (id, gateway_id, device_id) {
    return new Promise((resolve, reject) => {
        models.single_controls.destroy({
            where: { id: id, gateway_id: gateway_id, default_device_id: device_id }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}


//update single_controls
var updateSingleControl = function (id, data) {
    return new Promise((resolve, reject) => {
        models.single_controls.update(data, {
            where: { id: id }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}


var getDeviceSchedulesByDeviceId = function (device_id) {
    return new Promise(async (resolve, reject) => {
        // check valid device_id
        const deviceExist = await models.devices.findOne({
            where: { id: device_id },
            raw: true,
        }).then((result) => result).catch((error) => {
            reject(error)
        });
        if (!deviceExist) {
            const deviceRefObj = {
                id: null,
                schedules: [],
            };
            return deviceRefObj;
        }
        const getAllSchedules = await models.schedules.findAll({
            where: { device_id: device_id },
            raw: true,
        }).then((result) => result).catch((error) => {
            reject(error)
        });
        if (!deviceExist.mac_address) {
            const deviceRefObj = {
                id: null,
                schedules: [],
            };
            resolve(deviceRefObj);
        }
        let deviceMacAddress = deviceExist.mac_address;
        deviceMacAddress = deviceMacAddress.replace(/:/g, '');
        deviceMacAddress = deviceMacAddress.toLowerCase();

        const arrayOfSchedules = getAllSchedules.map(({ schedule }) => schedule);
        const schedulesObject = {
            id: deviceMacAddress,
            schedules: arrayOfSchedules,
        };
        resolve(schedulesObject);
    })
}

var getLinkedDevices = function (gateway_id) {
    return new Promise(async (resolve, reject) => {
        const singleControls = await models.single_controls.findAll({
            include: [{
                attributes: ['id', 'device_code', 'name', 'model', 'mac_address'],
                model: models.devices,
            },
            {
                model: models.single_control_devices,
                include: [{
                    attributes: ['id', 'device_code', 'name', 'model', 'mac_address'],
                    model: models.devices,
                }],
            }],
            where: { gateway_id },
        }).then((result) => {
            if (!result) {
                return [];
            }
            const resultArray = [];
            for (const element of result) {
                const obj = {
                    linkedDevices: {
                        name: element.name,
                    },
                    key: element.id
                };
                const defaultDeviceCode = element.device.device_code;
                const defaultDeviceCodeSplitArray = defaultDeviceCode.split('-');
                const defaultDevice = defaultDeviceCodeSplitArray[3];
                obj.linkedDevices.defaultDevice = defaultDevice.toLowerCase();
                obj.linkedDevices.devices = [];
                if (element.single_control_devices) {
                    for (const single_control_device of element.single_control_devices) {
                        const deviceCode = single_control_device.device.device_code;
                        const deviceCodeSplitArray = deviceCode.split('-');
                        const euid = deviceCodeSplitArray[3];
                        const deviceObj = {
                            oem_model: 'it600ThermHW',
                            EUID: euid.toLowerCase(),
                        };
                        obj.linkedDevices.devices.push(deviceObj);
                    }
                }
                resultArray.push(obj);
            }

            return resultArray;
        }).catch(() => resolve([]));
        resolve(singleControls);
    })
}


var getGatewayOneTouchRulesByDeviceId = function (device_id) {
    return new Promise(async (resolve, reject) => {
        let rulesObj = {
            rules: [],
            linkedDevices_list: [],
        };

        const onetouchRuleObj = await models.one_touch_rules.findAll({
            where: {
                gateway_id: device_id,
            },
        }).then((result) => result)
            .catch((error) => {
                reject(error)
            });
        // new code added to merge predefined rules in one touch rules object.
        const preDefinedRuleObj = await models.predefined_rules.findAll({
            where: {
                gateway_id: device_id,
            },
        }).then((result) => result)
            .catch((error) => {
                reject(error)
            });
        const linkedDeviceList = await getLinkedDevices(device_id).catch((error) => {
            reject(error)
        });

        if (!preDefinedRuleObj || !onetouchRuleObj || !linkedDeviceList) {
            resolve(rulesObj);
        }
        let finalRulesArray = [];
        let rulesOfBoth = onetouchRuleObj.concat(preDefinedRuleObj);
        let arrayOfRules = rulesOfBoth.map(({ rule }) => rule);
        for (const key in arrayOfRules) {
            const element = arrayOfRules[key];
            const activeValue = element.active;
            if (activeValue == true) {
                finalRulesArray.push(element);
            }
        }
        rulesObj = {
            rules: finalRulesArray,
            linkedDevices_list: linkedDeviceList,
        };

        resolve(rulesObj);
    })
}
//create device_references
var addDeviceReference = function (device_id, type) {
    return new Promise(async (resolve, reject) => {
        let data = null
        if (type == "schedule") {
            data = await getDeviceSchedulesByDeviceId(device_id).catch(err => {
                console.log("🚀 ~ data=awaitgetDeviceSchedulesByDeviceId ~ err:", err)
                reject(err)
            })
        } else if (type == "one_touch_rule") {
            data = await getGatewayOneTouchRulesByDeviceId(device_id).catch(err => {
                console.log("🚀 ~ data=awaitgetDeviceSchedulesByDeviceId ~ err:", err)
                reject(err)
            })
        }
        models.device_references.create({
            device_id: device_id, type: type, data
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err);
        })
    })
}

var deleteOccupantsDashboardAttributes = function (id, company_id) {
    return new Promise((resolve, reject) => {
        models.occupants_dashboard_attributes.destroy({
            where: {
                item_id: id
            }, returning: true
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

var deleteMultipleOccupantsDashboardAttributes = function (ids) {
    return new Promise((resolve, reject) => {
        models.occupants_dashboard_attributes.destroy({
            where: {
                item_id: {
                    [Op.in]: ids
                },
                company_id: companyId
            }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

// var deleteMultipleDeviceAlerts = function (deviceCodes) {
//     return new Promise((resolve, reject) => {
//         models.device_status_histories.destroy({
//             where: {
//                 'device.device_code': {
//                     [Op.in]: deviceCodes,
//                 }, company_id: companyId
//             }
//         }).then(result => {
//             resolve(result)
//         }).catch(err => {
//             reject(err)
//         })
//     })
// }

//delete multiple devices or gateways
var deleteMultipleDeviceOrGateway = function (ids) {
    return new Promise((resolve, reject) => {
        models.devices.destroy({
            where: {
                id: {
                    [Op.in]: ids
                }
            }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
        // resolve()
    })
}

const getUserNotificationTokens = function (occupantId) {
    return new Promise((resolve, reject) => {
        models.occupants_notification_tokens.findAll({
            where: {
                occupant_id: occupantId, [Op.or]: [
                    {
                        is_enable: {
                            [Op.eq]: true
                        }
                    },
                    {
                        is_enable: {
                            [Op.eq]: null
                        }
                    },
                ],
            }
        })
            .then(result => {
                resolve(result)
            }).catch((err) => {
                reject(err);
            });
    })
}

var sendEmailOrNotifications = function (occupantsPermissions, gateway, company_id) {
    return new Promise(async (resolve, reject) => {
        let notificationTokenLists = [];
        for (const element1 of occupantsPermissions) {
            let element = element1
            if (element1.dataValues) {
                element = element1.dataValues
                if (element.sharer_occupant && element.sharer_occupant.dataValues) {
                    element.sharer_occupant = element1.sharer_occupant.dataValues
                }
                if (element.receiver_occupant && element.receiver_occupant.dataValues) {
                    element.receiver_occupant = element1.receiver_occupant.dataValues
                }
            }
            const notificationToken = await getUserNotificationTokens(element.receiver_occupant_id)
                .catch((err) => {
                    reject(err);
                });
            if (notificationToken && notificationToken.length > 0) {
                notificationTokenLists = lodash.map(notificationToken, 'token');
            }
            if (element.receiver_occupant_id == element.sharer_occupant_id) {
                var placeholdersData = {
                    email: element.sharer_occupant.email,
                    first_name: element.sharer_occupant.first_name,
                    last_name: element.sharer_occupant.last_name,
                    gateway_name: gateway.name,
                    gateway_code: gateway.device_code,
                    receiverList: [{
                        email: element.sharer_occupant.email
                    }],
                    notificationTokenList: notificationTokenLists

                };
                addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.owner_unregistered_gateway,
                    gateway, Entities.notes.event_name.deleted, company_id, company_id, placeholdersData)
            } else {
                var placeholdersData = {
                    email: element.receiver_occupant.email,
                    first_name: element.receiver_occupant.first_name,
                    last_name: element.receiver_occupant.last_name,
                    gateway_name: gateway.name,
                    gateway_code: gateway.device_code,
                    receiverList: [{
                        email: element.receiver_occupant.email
                    }],
                    notificationTokenList: notificationTokenLists,
                };
                addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.gateway_unregistered,
                    gateway, Entities.notes.event_name.deleted, company_id, company_id, placeholdersData)
            }
        }
        resolve();
    })
}
//manage gateway delete operations 
var manageGatewayDelete = function (gateway_code, company_id, jobId) {
    return new Promise(async (resolve, reject) => {
        if (!jobId) {
            var job = await createJob("deleteGateway", "Started", {
                deviceCode: gateway_code
            }, company_id).catch(err => {
                reject(err)
            })
            jobId = job.id
        }
        var obj = { gateway_code: gateway_code }
        addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, obj, "Checking gateway is available.", jobId, company_id)
        checkDeviceOrGatewayExists(gateway_code, company_id).then(async (gateway) => {

            if (!gateway) {
                addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, obj, "Gateway not found, job finished.", jobId, company_id)
                resolve()
            } else {
                if (gateway.company_id) {
                    company_id = gateway.company_id;
                }
                //if exists delete gateway
                addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, gateway, "Gateway found.", jobId, company_id)
                var gateway_id = gateway.id
                var callFromGateway = true;
                // find if gateway has occupants permissions
                var occupantsPermissions = await models.occupants_permissions.findAll(
                    {
                        include: [{
                            attributes: ['id', 'email', 'first_name', 'last_name', 'phone_number', 'identity_id', 'cognito_id'],
                            model: models.occupants,
                            as: 'receiver_occupant',
                        },
                        {
                            attributes: ['id', 'email', 'first_name', 'last_name', 'phone_number', 'identity_id', 'cognito_id'],
                            model: models.occupants,
                            as: 'sharer_occupant',
                        },
                        ],
                        where: {
                            gateway_id,
                            receiver_occupant_id: {
                                [Op.ne]: null
                            }
                        }
                    })
                if (occupantsPermissions) {
                    addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, occupantsPermissions, "occupantsPermissions found.", jobId, company_id)
                } else {
                    addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, obj, "occupantsPermissions not found.", jobId, company_id)
                }
                // delete activity logs related to this gateway
                await deleteActivityLogs(gateway_id).then(result => {
                    if (result && result.length > 0) {
                        addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.activity_log_delete, { count: result.length }, "Gateway activity logs deleted sucessfully.", jobId, company_id)
                    } else {
                        addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, { count: result.length }, "Gateway activity logs are not avaialble.", jobId, company_id)
                    }
                    return result
                }).catch(err => {
                    reject(err);
                });
                //delete gateway dashboard attributes
                await deleteOccupantsDashboardAttributes(gateway_id, company_id).then((result) => {
                    addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Occupants dashboard attributes for gateway deleted successfully.", jobId, company_id)
                    return result
                }).catch(err => {
                    reject(err);
                });
                //delete one touch communication configs created on one touch 
                var oneTouchRuleIds = await models.one_touch_rules.findAll(
                    {
                        where: {
                            gateway_id
                        }, returning: true,
                    }
                ).then(async (result) => {
                    var ids = []
                    if (result && result.length > 0) {
                        for (const oneTouch of result) {
                            ids.push(oneTouch.id)
                        }
                        addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, ids, "One touch rules for gateway find successfully.", jobId, company_id)
                        return ids;
                    } else {
                        return [];
                    }

                }).catch(err => {
                    reject(err);
                });
                if (oneTouchRuleIds && oneTouchRuleIds.length > 0) {
                    var oneTouchCommunicationConfig = await models.one_touch_communication_configs.destroy({
                        where: {
                            one_touch_rule_id: {
                                [Op.in]: oneTouchRuleIds
                            }
                        },
                        returning: true,
                    }).then(result => {
                        addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "One touch communication configs for one touch rules created on gateway  deleted successfully.", jobId, company_id)
                        return result;
                    }).catch(err => {
                        reject(err);
                    });
                }

                //delete alert communication configs
                var deviceAlertCommunicationConfig = await models.alert_communication_configs.destroy({
                    where: { device_id: gateway_id },
                    returning: true,
                }).then(result => {
                    addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Alert communication configs for gateway deleted successfully.", jobId, company_id)
                    return result;
                }).catch(err => {
                    reject(err);
                });

                //delete rule groups created on that gateway
                var ruleGroups = await models.rule_groups.destroy(
                    {
                        where: {
                            gateway_id
                        }, returning: true,
                    }
                ).then(async (result) => {
                    addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Rule groups created on gateway deleted successfully.", jobId, company_id)
                    return result;
                }).catch(err => {
                    reject(err);
                });
                //delete device alerts
                let categorya_enabled = process.env.CATEGORYSA_ENABLED;
                if ((categorya_enabled == true || categorya_enabled == 'true')) {
                    var deviceAlerts = await models.device_alerts.destroy({
                        where: { device_id: gateway_id },
                        returning: true,
                    }).then(result => {
                        addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Device active alerts for gateway deleted successfully.", jobId, company_id)
                        return result;
                    }).catch(err => {
                        reject(err);
                    });
                }
                //delete device events
                let categoryb_enabled = process.env.CATEGORYB_ENABLED;
                if ((categoryb_enabled == true || categoryb_enabled == 'true')) {
                    var deviceEvents = await categoryb_models.device_events.destroy({
                        where: {
                            device_code: gateway_code,
                            property_name: {
                                [Op.ne]: 'connected'
                            }
                        },
                        returning: true,
                    }).then(result => {
                        addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Device events for gateway deleted successfully from category A.", jobId, company_id)
                        return result;
                    }).catch(err => {
                        reject(err);
                    });
                }

                var deviceEvents = await models.device_events.destroy({
                    where: {
                        device_code: gateway_code,
                        property_name: {
                            [Op.ne]: 'connected'
                        }
                    },
                    returning: true,
                }).then(result => {
                    addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Device events for gateway deleted successfully.", jobId, company_id)
                    return result;
                }).catch(err => {
                    reject(err);
                });
                if (process.env.REDSHIFT_DB_NAME && process.env.REDSHIFT_DB_USER && process.env.REDSHIFT_DB_PASSWORD && process.env.REDSHIFT_DB_HOST && parseInt(process.env.REDSHIFT_DB_PORT)) {
                    var deleteDeviceEventsRedshift = executeQuery(`DELETE FROM app_aggregates.device_events where device_code = '${gateway_code}'`).then(result => {
                        return result;
                    }).catch(err => {
                        reject(err);
                    });
                }
                //delete the one_touch rules ,update shadow 
                var oneTouchRules = await models.one_touch_rules.destroy(
                    {
                        where: {
                            gateway_id
                        }, returning: true,
                    }
                ).then(async (result) => {
                    addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "One touch rules for gateway deleted successfully.", jobId, company_id)
                    return result;
                }).catch(err => {
                    reject(err);
                });
                //delete the predefined rules 
                var predefinedRules = await models.predefined_rules.destroy(
                    {
                        where: {
                            gateway_id
                        }, returning: true,
                    }
                ).then(async (result) => {
                    addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Predefined rules for device deleted successfully.", jobId, company_id)
                    return result;
                }).catch(err => {
                    reject(err);
                });
                // update the gateway id for camera
                await models.camera_devices.update({
                    gateway_id: null,
                }, {
                    where: {
                        gateway_id

                    },
                }).then(async (result) => {
                    addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "successfully updated gateway_id for camera.", jobId, company_id)
                    return result;
                }).catch(err => {
                    reject(err);
                });
                //delete occupant permissions
                var occupantPermissions = await models.occupants_permissions.destroy(
                    {
                        where: {
                            gateway_id
                        },
                        returning: true,
                    }
                ).then(async (result) => {
                    addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Occupant permissions for gateway deleted successfully.", jobId, company_id)
                    return result;
                }).catch(err => {
                    reject(err);
                });
                //delete occupant groups created on that gateway
                var occupantsGroups = await models.occupants_groups.destroy(
                    {
                        where: {
                            item_id: gateway_id
                        },
                        returning: true,
                    }
                ).then(async (result) => {
                    addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Occupant groups for gateway deleted successfully.", jobId, company_id)
                    return result;
                }).catch(err => {
                    reject(err);
                });

                // delete single controls and devices
                const getSingleControlAndDevicesData = await getGatewaySingleControlAndDevice(gateway_id)
                    .then((result) => {
                        return (result);
                    }).catch(err => {
                        reject(err);
                    });

                // check if SC has many records along with SCD                                
                let singleControlDevicesArray = null;
                if (Object.keys(getSingleControlAndDevicesData).length > 0) {
                    for (const key in getSingleControlAndDevicesData) {
                        const element = getSingleControlAndDevicesData[key];
                        if (Object.keys(element.single_control_devices).length > 0) {
                            singleControlDevicesArray = element.single_control_devices;

                            for (const key in singleControlDevicesArray) {
                                const element = singleControlDevicesArray[key];
                                const deleteSingleControlDevices = await deleteSingleControlDevice_on_id(element.device_id, element.single_control_id)
                                    .then((result) => {
                                        return (result);
                                    }).catch(err => {
                                        reject(err);
                                    });
                            }
                        }

                        const deleteSingleControls = await deleteSingleControl_Gateway(element.id, element.gateway_id, element.default_device_id)
                            .then((result) => {
                                return (result);
                            }).catch(err => {
                                reject(err);
                            });
                    }
                    // addDeviceReference and publishJsonUrl
                    // creating reference in device rule_reference
                    let type = "one_touch_rule";
                    const deviceReferenceObj = await addDeviceReference(gateway_id, type)
                        .then((result) => {
                            return (result);
                        }).catch(err => {
                            reject(err);
                        });

                    const ref = deviceReferenceObj.id;
                    const host = process.env.SERVICE_HOST || 'dev-service.ctiotsolution.com';
                    const url = `https://${host}/api/v1/one_touch/gateway_rules?ref=${ref}`;
                    await publishJsonUrl(company_id, gateway.device_code, url);
                }

                await addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, gateway, "Deleting devices connected to gateway started.", jobId, company_id)
                //get devices which are connected to this gateway
                var devices = await getAllGatewayDevices(gateway_id)
                    .then(devices => {
                        return devices
                    }).catch(err => {
                        reject(err);
                    });

                // delete gateway
                deleteDeviceOrGateway(gateway_id)
                    .then(async (result) => {
                        if (occupantsPermissions && occupantsPermissions.length > 0) {
                            await sendEmailOrNotifications(occupantsPermissions, gateway, company_id).catch(err => {
                                reject(err);
                            });
                        }
                        addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.gateway_delete, gateway, "Gateway deleted successfully, job finished.", jobId, company_id)

                        let unlink_gateway_obj = {
                            new: {},
                            old: gateway,
                        };
                        if (gateway.location_id) {
                            addActivityLog(Entities.locations.entity_name, Entities.locations.event_name.gateway_unlinked, unlink_gateway_obj, "Gateway Location Unlinked successfully.", gateway.location_id, company_id)
                        }
                        updateJob("Finished", jobId)
                    }).catch(err => {
                        reject(err);
                    });
                if (devices && devices.result && devices.result.length > 0) {
                    var deviceCodeLists = devices.deviceCodeLists;
                    var deviceIdLists = devices.deviceIdLists;
                    var deviceDeletePromiseList = [];
                    for (const device of devices.result) {
                        deviceDeletePromiseList.push(await manageDeviceDelete(device.device_code, company_id, jobId, callFromGateway))
                    }
                    await Promise.all(deviceDeletePromiseList)
                        .then((results) => {
                            return results;
                        }).catch(err => {
                            addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, err.stack, "Device Delete promise failed", jobId, company_id)
                        });
                } else {
                    await addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, obj, "Devices not found.", jobId, company_id)
                }
                //calling device provision to unregister the gateway device.not needed
            }
        })
        resolve()

    })
}

//manage device delete operations 
var manageDeviceDelete = function (device_code, company_id, jobId, callFromGateway) {
    return new Promise((resolve, reject) => {
        var obj = { device_code: device_code }
        addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, obj, "Checking device is available.", jobId, company_id)
        // addActivityLog("Job", "deleteDevice", obj, "Device delete job started.", jobId, company_id)

        checkDeviceOrGatewayExists(device_code, company_id).then(async (device) => {
            //if exists delete device
            if (device) {
                if (device.company_id) {
                    company_id = device.company_id;
                }
                addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job,
                    device, "Device found.", jobId, company_id)
                var device_id = device.id

                //delete activitylogs which are connected to this devices
                deleteActivityLogs(device_id)
                    .then(result => {
                        if (result && result.length > 0) {
                            addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.activity_log_delete, result, "Activity logs deleted successfully.", jobId, company_id)
                        } else {
                            addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Activity logs are not avaialble.", jobId, company_id)
                        }
                    }).catch(err => {
                        reject(err);
                    });

                //delete the devices from occupant groups devices
                let occupantGroupsDevice = await models.occupants_groups_devices.findOne(
                    { where: { device_id: device.id } }
                ).catch(err => {
                    reject(err);
                });
                // console.log("🚀 ~ file: DeviceDeleteHandler.js:768 ~ checkDeviceOrGatewayExists ~ occupantGroupsDevice:", occupantGroupsDevice)
                if (occupantGroupsDevice) {
                    await models.occupants_groups_devices.destroy(
                        { where: { device_id: device.id } }
                    ).then(result => {
                        // console.log("🚀 ~ file: DeviceDeleteHandler.js:772 ~ checkDeviceOrGatewayExists ~ result:", result)
                        addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Devices deleted from Occupant groups  successfully.", jobId, company_id)
                        return result;
                    }).catch(err => {
                        reject(err);
                    });
                    let groupId = occupantGroupsDevice.occupant_group_id;
                    const groupDevices = await models.occupants_groups_devices.count({
                        where: {
                            occupant_group_id: groupId
                        },
                    })
                    // console.log("🚀 ~ file: DeviceDeleteHandler.js:783 ~ checkDeviceOrGatewayExists ~ groupDevices:", groupDevices)
                    if (groupDevices <= 0) {
                        var occupantsGroups = await models.occupants_groups.destroy(
                            {
                                where: {
                                    id: groupId
                                },
                                returning: true,
                            }
                        ).then(async (result) => {
                            // console.log("🚀 ~ file: DeviceDeleteHandler.js:793 ~ ).then ~ result:", result)
                            addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Occupant group deleted successfully.", jobId, company_id)
                            return result;
                        }).catch(err => {
                            reject(err);
                        });
                    }
                }

                //delete device alerts
                var deviceAlerts = await models.device_alerts.destroy({
                    where: { device_id: device.id },
                    returning: true,
                }).then(result => {
                    addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Device active alerts for device deleted successfully.", jobId, company_id)
                    return result;
                }).catch(err => {
                    reject(err);
                });

                let categoryb_enabled = process.env.CATEGORYB_ENABLED;
                if ((categoryb_enabled == true || categoryb_enabled == 'true')) {
                    var deviceEvents = await categoryb_models.device_events.destroy({
                        where: {
                            device_code: device_code
                        },
                        returning: true,
                    }).then(result => {
                        addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Device events for gateway deleted successfully from category A.", jobId, company_id)
                        return result;
                    }).catch(err => {
                        reject(err);
                    });
                }
                //delete device events
                await createJob("deleteDeviceEvents", "Started", {
                    deviceCode: device_code
                }, company_id).then(result => {
                    var jobId = result.id
                    let input = { device_code, "deleted_at": new Date().toISOString(), "retry_count": 0 }
                    const obj = {
                        jobId,
                        type: "deleteDeviceEvents",
                        input,
                        companyId: company_id,
                    };
                    genericJobQueue.sendProducer(obj);
                }).catch(err => {
                    reject(err);
                });
                // var deviceEvents = await models.device_events.destroy({
                //     where: {
                //         device_code: device_code
                //     },
                //     returning: true,
                // }).then(result => {
                //     addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Device events for device deleted successfully.", jobId, company_id)
                //     resolve(result);
                // }).catch(err => {
                //     reject(err);
                // });

                if (process.env.REDSHIFT_DB_NAME && process.env.REDSHIFT_DB_USER && process.env.REDSHIFT_DB_PASSWORD && process.env.REDSHIFT_DB_HOST && parseInt(process.env.REDSHIFT_DB_PORT)) {
                    // console.log("redshift delete device history data", device_code, process.env.REDSHIFT_DB_NAME)
                    var deleteDeviceEventsRedshift = await executeQuery(`DELETE FROM app_aggregates.device_events where  device_code = '${device_code}'`).then(result => {
                        return result;
                    }).catch(err => {
                        reject(err);
                    });
                }
                //delete alert communication configs
                var deviceAlertCommunicationConfig = await models.alert_communication_configs.destroy({
                    where: { device_id: device.id },
                    returning: true,
                }).then(result => {
                    addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Alert communication configs for device deleted successfully.", jobId, company_id)
                    return result;
                }).catch(err => {
                    reject(err);
                });

                //delete from alert_configs table

                //delete occupant dashboard attributes 
                await deleteOccupantsDashboardAttributes(device_id, company_id)
                    .then((result) => {
                        addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Occupants dashboard attributes for device deleted successfully.", jobId, company_id)
                        return result;
                    }).catch(err => {
                        reject(err);
                    });

                //delete device status history 
                // await deleteDeviceStatusHistories(device_code, company_id)
                //     .then((result) => {
                //         addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Status histories for device deleted successfully.", jobId, company_id)
                //         return result;
                //     }).catch(err => {
                //         reject(err);
                //     });

                //delete device schedules 
                const schedules = await deleteDeviceSchedules(device_id, company_id)
                    .then((result) => {
                        addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Schedules for device deleted successfully.", jobId, company_id)
                        return result;
                    }).catch(err => {
                        reject(err);
                    });

                //delete device from device_references 
                const device_references = await deleteDeviceReferences(device_id)
                    .then((result) => {
                        addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Device references for device deleted successfully.", jobId, company_id)
                        return result;
                    }).catch(err => {
                        reject(err);
                    });

                //delete the record from single_controls and SCD   
                if (callFromGateway == false) {
                    const getSingleControlAndDevicesData = await getSingleControlAndDevice(device_id)
                        .then((result) => {
                            return (result);
                        }).catch(err => {
                            reject(err);
                        });
                    if (!getSingleControlAndDevicesData) {
                        const getSingleControlDevices = await getSingleControlDevice(device_id)
                            .then((result) => {
                                return (result);
                            }).catch(err => {
                                reject(err);
                            });
                        if (getSingleControlDevices) {
                            const deleteSingleControlDevices = await deleteSingleControlDevice(device_id)
                                .then((result) => {
                                    return (result);
                                }).catch(err => {
                                    reject(err);
                                });
                        }
                    }
                    let gatewayExist = null;
                    let singleControlDevicesArray = null;
                    let exDefaultDevices = [];
                    if (getSingleControlAndDevicesData && Object.keys(getSingleControlAndDevicesData.single_control_devices).length > 0) {
                        singleControlDevicesArray = getSingleControlAndDevicesData.single_control_devices;
                        // check valid gateway_id
                        gatewayExist = await models.devices.findOne(
                            { where: { id: getSingleControlAndDevicesData.gateway_id } }
                        ).then(result => {
                            return result;
                        }).catch(err => {
                            reject(err);
                        });

                        if (Object.keys(singleControlDevicesArray).length == 1) {
                            for (const key in singleControlDevicesArray) {
                                const element = singleControlDevicesArray[key];
                                // check if the device id matches with the default device id then delete the record from SCD    
                                if (device_id == element.device_id) {
                                    const deleteSingleControlDevices = await deleteSingleControlDevice(device_id)
                                        .then((result) => {
                                            return (result);
                                        }).catch(err => {
                                            reject(err);
                                        });
                                }
                            }
                            const deleteSingleControls = await deleteSingleControl(getSingleControlAndDevicesData.id, getSingleControlAndDevicesData.default_device_id)
                                .then((result) => {
                                    return (result);
                                }).catch(err => {
                                    reject(err);
                                });
                        }

                        if (Object.keys(singleControlDevicesArray).length > 1) {
                            for (const key in singleControlDevicesArray) {
                                const element = singleControlDevicesArray[key];
                                // check if the device id matches with the default device id then delete the record from SCD
                                if (device_id == element.device_id) {
                                    const deleteSingleControlDevices = await deleteSingleControlDevice(element.device_id)
                                        .then((result) => {
                                            return (result);
                                        }).catch(err => {
                                            reject(err);
                                        });
                                } else {
                                    exDefaultDevices.push(element);
                                }
                            };
                            // if element is present in excluded array then update SC
                            if (Object.keys(exDefaultDevices).length >= 1) {
                                //update 
                                const new_default_device_id = exDefaultDevices[0].device_id;
                                const update_data = { default_device_id: new_default_device_id };
                                var device_id = new_default_device_id;
                                var device = await models.devices.findOne({
                                    where: {
                                        id: device_id,
                                    }
                                }).then(result => {
                                    return (result)
                                }).catch(err => {
                                    reject(err)
                                })
                                if (device) {
                                    let type = "schedule";
                                    const deviceReferenceObj = await addDeviceReference(device_id, type)
                                        .then((result) => {
                                            return (result);
                                        }).catch(err => {
                                            reject(err);
                                        });

                                    const ref = deviceReferenceObj.id;
                                    const host = process.env.SERVICE_HOST || 'dev-service.ctiotsolution.com';
                                    const url = `https://${host}/api/v1/schedules/device_schedules?ref=${ref}`;

                                    // console.log("🚀 ~ checkDeviceOrGatewayExists ~ url:", url)
                                    await CommunicateWithAwsIotService.publishGenScheURL(device.company_id, device.device_code, url);
                                }
                                const update_SC = await updateSingleControl(getSingleControlAndDevicesData.id, update_data)
                                    .then((result) => {
                                        return (result);
                                    }).catch(err => {
                                        reject(err);
                                    });
                            }
                        }
                        // addDeviceReference and publishJsonUrl
                        // creating reference in device rule_reference
                        let type = "one_touch_rule";
                        const deviceReferenceObj = await addDeviceReference(getSingleControlAndDevicesData.gateway_id, type)
                            .then((result) => {
                                return (result);
                            }).catch(err => {
                                reject(err);
                            });

                        const ref = deviceReferenceObj.id;
                        const host = process.env.SERVICE_HOST || 'dev-service.ctiotsolution.com';
                        const url = `https://${host}/api/v1/one_touch/gateway_rules?ref=${ref}`;
                        await publishJsonUrl(company_id, gatewayExist.device_code, url);
                    }
                }

                //delete one_touch_rules for device 
                if (device.gateway_id) {
                    await models.one_touch_rules.findAll(
                        {
                            where: {
                                gateway_id: device.gateway_id
                            }, returning: true,
                        }
                    ).then(async (data) => {
                        if (data && data.length > 0) {
                            for (let element in data) {
                                const item = data[element];
                                let rule = item.rule
                                let StrngifyRule = JSON.stringify(rule);
                                if (rule.hasOwnProperty('name')) {
                                    if (rule['name'].startsWith('_P65FD8T6S') === true) {
                                        const splitArr = device_code.split('-');
                                        if (splitArr.length > 2) {
                                            let device_mac_address = `${splitArr[3]}`;
                                            device_mac_address = new RegExp(device_mac_address, "i")
                                            if (StrngifyRule.match(device_mac_address) !== null) {
                                                await models.one_touch_rules.destroy(
                                                    {
                                                        where: {
                                                            id: item.id,
                                                        },
                                                    }).catch(err => {
                                                        Logger.error("Error while deleting the one touch rules", err);
                                                    });
                                            }
                                        }
                                    }
                                }
                            }

                        }
                    }).catch(err => {
                        reject(err);
                    });
                }

                //  delete record from smartplug energymeter app_smartplug app_energymeter
                try {
                    var smartplugModelList = ['SPE600', 'SAL2', 'SP600', 'SX885ZB'];
                    var energymeterModelList = ['SAL2EM1', 'ECM600']
                    if (smartplugModelList.includes(device.model)) {
                        await models.sequelize.query('delete from smartplug where dsnid = :device_code',
                            {
                                raw: true,
                                replacements: { device_code },
                                logging: console.log,
                            }).then((result) => {
                                addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "record for smartplug deleted successfully.", jobId, company_id)
                            })

                        await models.sequelize.query('delete from app_smartplug where dsnid = :device_code',
                            {
                                raw: true,
                                replacements: { device_code },
                                logging: console.log,
                            }).then((result) => {
                                addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "record for app_smartplug deleted successfully.", jobId, company_id)
                            })
                    }

                    if (energymeterModelList.includes(device.model)) {
                        await models.sequelize.query('delete from energymeter where dsnid = :device_code',
                            {
                                raw: true,
                                replacements: { device_code },
                                logging: console.log,
                            }).then((result) => {
                                addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "record for energymeter deleted successfully.", jobId, company_id)
                            })

                        await models.sequelize.query('delete from app_energymeter where dsnid = :device_code',
                            {
                                raw: true,
                                replacements: { device_code },
                                logging: console.log,
                            }).then((result) => {
                                addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, result, "record for app_energymeter deleted successfully.", jobId, company_id)
                            })
                    }
                }

                catch (error) {
                    addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, error, "error in delete device.", jobId, company_id)
                }

                //finally delete device
                deleteDeviceOrGateway(device_id)
                    .then(async (result) => {
                        addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.device_delete, device, "Device deleted successfully.", jobId, company_id)

                        let gateway = await models.devices.findOne(
                            { where: { id: device.gateway_id } }
                        ).then(result => {
                            return result;
                        }).catch(err => {
                            reject(err);
                        });
                        if (gateway != null) {
                            const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');

                            let deviceListChanged = {
                                "deviceListChanged": {
                                    "event": true,
                                    "eventTime": formattedDateTime,
                                }
                            }
                            publishSyncBlockProperty(company_id, gateway.device_code, deviceListChanged);
                        }
                        //new activityLog
                        let unlink_obj = {
                            new: {},
                            old: device,
                        };
                        if (device.location_id) {
                            addActivityLog(Entities.locations.entity_name, Entities.locations.event_name.device_unlinked, unlink_obj, "Device Location Unlinked successfully.", device.location_id, company_id)
                        }
                        resolve()
                    }).catch(err => {
                        reject(err);
                    });


            } else {
                addActivityLog(Entities.deleteDevice.entity_name, Entities.deleteDevice.event_name.job, { device_code: device_code }, "Device not found", jobId, company_id)
                // updateJob("Finished", jobId)
                resolve()
            }
        })
    })
}

var getJob = function (jobId) {
    return new Promise((resolve, reject) => {

        models.jobs.findOne({
            where: {
                id: jobId
            },
            include: [{
                model: models.companies
            }]
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}
//manage both device and gateway
var manage = function (obj, pointer) {
    return new Promise(async (resolve, reject) => {
        const deviceCode = obj.topic_name
        const company = await getCompany(null, process.env.COMPANY_CODE).then(result => {
            return (result);
        }).catch(err => {
            reject(err);
        });
        var companyId = company.id;
        const splitArr = deviceCode.split('-');
        const gateway = `${splitArr[0]}-${splitArr[1]}`;
        await deleteFromCache("DeleteDevice", deviceCode)
        await deleteFromCacheUsingKey(deviceCode)

        // Logger.info("Initialized-Device-Delete-Job", { "deviceCode": deviceCode })
        if (splitArr.length === 2) {

            //first create job
            createJob("deleteGateway", "Started", {
                deviceCode: deviceCode
            }, companyId).then(result => {
                var jobId = result.id
                manageGatewayDelete(deviceCode, companyId, jobId)
                    .then(result => {
                        updateJob("Finished", jobId)
                        resolve(result)
                    }).catch(err => {
                        reject(err)
                    })
            }).catch(err => {
                reject(err)
            })

        } else if (splitArr.length > 2) {

            createJob("deleteDevice", "Started", {
                deviceCode: deviceCode
            }, companyId).then(result => {
                var jobId = result.id
                // Logger.info("Device-Delete-typeDevice", { "deviceCode": deviceCode })
                var callFromGateway = false;
                manageDeviceDelete(deviceCode, companyId, jobId, callFromGateway)
                    .then(result => {
                        updateJob("Finished", jobId)
                        // Logger.info("Finished-Device-Delete-Job", { "deviceCode": deviceCode })
                        resolve(result)
                    }).catch(err => {
                        reject(err)
                    })
            }).catch(err => {
                reject(err)
            })

        }

    })
}

module.exports = {
    manage, manageGatewayDelete, addDeviceReference, getSingleControlDevice
}