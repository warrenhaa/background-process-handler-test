const lodash = require('lodash');
const models = require('../models');
const categoryb_models = require('../categoryb_models');
const { setInCache, getOneFromCache, setDataWithDateCacheKey, getIncreament, deleteFromCache, deleteFromCacheUsingKey } = require('../cache/Cache');
const { Constant } = require('../Constants');
const Logger = require('../Logger');
const { result } = require('lodash');
const { Entities } = require('../utils/Entities');
let { addActivityLog } = require('../services/ActivityLogService')
var companyId = null
const jsonDiff = require('json-diff');
const { alertCommunicationConfig } = require('../handler/AlertCommunicationHandler');
const { oneTouchCommunicationConfig } = require('../handler/OneTouchCommunicationConfig');
const { getFromTable, addToTable, updateTable } = require('../dynamodb');
const { manageGatewayDelete, addDeviceReference } = require('./DeviceDeleteHandler');
const { createJob, updateJob } = require('../services/JobsService')
const CommunicateWithAwsIotService = require('../services/CommunicateWithAwsIotService');
const { Op } = require('sequelize');
const { sleep } = require('../Helper')
const sqsFileUploadProducer = require('../sqs/FileUploadProducer');
const { getCompany } = require('../cache/Companies');
const cloudBridgeQueueProducer = require('../sqs/CloudBridgeQueueProducer');
const moment = require('moment');
const { createIssue, getIssue } = require('../services/GitlabTicketService')

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

// create reference and publish property
function ReUploadJsonUrl(obj) {
    return new Promise(async (resolve, reject) => {
        if (obj.type == "one_touch_rule") {
            await OneTouchFileReUpload(obj)
                .then((result) => {
                    resolve()
                }).catch(err => {
                    reject(err)
                })
        }

        if (obj.type == "schedule") {
            await SchedulesFileReUpload(obj)
                .then((result) => {
                    resolve()
                }).catch(err => {
                    reject(err)
                })
        }
    })
}

function OneTouchFileReUpload(obj) {
    return new Promise(async (resolve, reject) => {
        var device_id = obj.device_id;
        var company_code = obj.company_code;
        var deviceCode = obj.deviceCode;
        var deviceStatus = obj.deviceStatus;
        var consumerRuleTimeStamp = obj.ruleTimeStamp;
        var company_id = obj.company_id;
        var type = obj.type;
        var params = {
            thingName: deviceCode, /* required */
        };
        // console.log("🚀 ~ returnnewPromise ~ params OneTouchFileReUpload: 75", params)
        // add code here for check shadow
        const getShadowData = await CommunicateWithAwsIotService.communicateWithAwsIot(params, company_id, 'getThingShadow');
        let base_key = null;
        let ruleTimeStampValue = null;
        let deviceRuleTimeStamp = null;

        if (getShadowData) {
            // gateway shadow not updated
            var payload = JSON.parse(getShadowData.payload);
            const { reported } = payload.state; // array
            const { connected } = reported;
            Object.keys(reported).forEach(async (key) => {
                if (reported[key].hasOwnProperty('properties')) {
                    const { properties } = reported[key];
                    base_key = key;
                    if (Object.keys(properties).length > 0) {
                        deviceRuleTimeStamp = Object.keys(properties).filter((name) => name.endsWith(":sRule:RuleTimeStamp"));
                        ruleTimeStampValue = properties[deviceRuleTimeStamp[0]];
                    }
                }
            });
            if (deviceRuleTimeStamp && deviceRuleTimeStamp.length > 0) {
                // latest
                if ((ruleTimeStampValue != 0 || ruleTimeStampValue != "0") && ruleTimeStampValue != null && (connected == 'true' || connected == true)) {
                    if (ruleTimeStampValue == consumerRuleTimeStamp) {
                        const file = '/tmp/rule_in/rule.json';
                        // adding device reference record
                        const deviceReferenceObj = await addDeviceReference(device_id, type)
                            .then((result) => {
                                return (result);
                            }).catch(err => {
                                reject(err);
                            });
                        const ruleTimeStampProperty = ':sRule:SetUpdateRuleJsonURL';
                        const token = deviceReferenceObj.id;
                        const host = process.env.SERVICE_HOST;
                        const api = `https://${host}/api/v1/devices/one_touch_rules?token=${token}&company_code=${company_code}`;
                        const url = `curl --location -k --request POST '${api}' --header 'Accept: /' --form 'file=@${file}'`;
                        // working below code
                        // console.log("🚀 ~ returnnewPromise ~ url OneTouchFileReUpload 115:", url)
                        await CommunicateWithAwsIotService.publishDeviceName(company_id, deviceCode, ruleTimeStampProperty, url);
                        // send data to producer
                        const data = {
                            ruleTimeStamp: ruleTimeStampValue,
                            type,
                            // extra
                            device_id, deviceCode, deviceStatus, company_code, company_id
                        }
                        sqsFileUploadProducer.sendProducer(data, 300);

                    } else {
                        resolve()
                    }
                } else {
                    resolve()
                }
            } else {
                resolve()
            }
        } else {
            resolve()
        }

    })
}

function SchedulesFileReUpload(obj) {
    return new Promise(async (resolve, reject) => {
        var device_id = obj.device_id;
        var company_code = obj.company_code;
        var deviceCode = obj.deviceCode;
        var deviceStatus = obj.deviceStatus;
        var consumerScheduleTimeStamp = obj.scheduleTimeStamp;
        var company_id = obj.company_id;
        var type = obj.type;
        var file_euid = obj.euid;
        var params = {
            thingName: deviceCode, /* required */
        };
        // console.log("🚀 ~ returnnewPromise ~ params SchedulesFileReUpload 155:", params)
        // add code here for check shadow
        const getShadowData = await CommunicateWithAwsIotService.communicateWithAwsIot(params, company_id, 'getThingShadow');
        let base_key = null;
        let scheduleTimeStampValue = null;
        let deviceScheduleTimeStamp = null;

        if (getShadowData) {
            // gateway shadow not updated
            var payload = JSON.parse(getShadowData.payload);
            const { reported } = payload.state; // array
            const { connected } = reported;
            Object.keys(reported).forEach(async (key) => {
                if (reported[key].hasOwnProperty('properties')) {
                    const { properties } = reported[key];
                    base_key = key;
                    if (Object.keys(properties).length > 0) {
                        deviceScheduleTimeStamp = Object.keys(properties).filter((name) => name.endsWith(":sGenSche:GenScheTimeStamp"));
                        scheduleTimeStampValue = properties[deviceScheduleTimeStamp[0]];
                    }
                }
            });
            // for schedules time stamp reupload
            if (deviceScheduleTimeStamp && deviceScheduleTimeStamp.length > 0) {
                // latest
                if ((scheduleTimeStampValue != 0 || scheduleTimeStampValue != "0") && scheduleTimeStampValue != null && (connected == 'true' || connected == true)) {
                    if (scheduleTimeStampValue == consumerScheduleTimeStamp) {

                        const euid = file_euid;
                        const file = `/tmp/schedule/run/sch_${euid}.json`;
                        // adding device reference record
                        const deviceReferenceObj = await addDeviceReference(device_id, type)
                            .then((result) => {
                                return (result);
                            }).catch(err => {
                                reject(err);
                            });
                        const scheduleTimeStampProperty = ':sGenSche:SetUpdateGenScheURL';
                        const token = deviceReferenceObj.id;
                        const host = process.env.SERVICE_HOST;
                        const api = `https://${host}/api/v1/devices/schedules?token=${token}&company_code=${company_code}`;
                        const url = `curl --location -k --request POST '${api}' --header 'Accept: /' --form 'file=@${file}'`;
                        // working below code
                        // console.log("🚀 ~ returnnewPromise ~ url: SchedulesFileReUpload 198", url)
                        await CommunicateWithAwsIotService.publishDeviceName(company_id, deviceCode, scheduleTimeStampProperty, url);

                        // send data to producer
                        const data = {
                            scheduleTimeStamp: scheduleTimeStampValue,
                            type,
                            euid,
                            // extra
                            device_id, deviceCode, deviceStatus, company_code, company_id
                        }
                        sqsFileUploadProducer.sendProducer(data, 300);

                    } else {
                        resolve()
                    }
                } else {
                    resolve()
                }
            } else {
                resolve()
            }
        } else {
            resolve()
        }

    })
}

//update device or gateway
var updateDeviceOrGateway = function (values, device_code, company_id) {
    return new Promise(async (resolve, reject) => {
        // Logger.info("updateDeviceOrGateway ", { "message": "values", "data": values });
        checkDeviceOrGatewayExists(device_code, company_id).then((result) => {
            //if exists update
            if (result) {
                // Using Object.entries()
                let isChanged = false
                for (let [key, value] of Object.entries(values)) {
                    if (result[key] != value && key != 'mac_address' && key != 'datapoints') {
                        // console.log("---> changes key", key, result[key], value)
                        isChanged = true;
                        break;
                    }
                    else if (key == 'datapoints') {
                        if (result["datapoints"] == null) {
                            // isChanged = true;
                        } else {
                            for (let [datapointKey, datapointvalue] of Object.entries(value)) {
                                if (result["datapoints"] && result["datapoints"][datapointKey] != datapointvalue) {
                                    // isChanged = true;
                                    break;
                                }
                            }
                        }
                    }
                }
                if (isChanged == true) {
                    // console.log("---> changes", result.dataValues, values, device_code)
                    models.devices.update(values, {
                        where: {
                            device_code
                        },
                        returning: true,
                    }).then(async (result) => {
                        // Logger.info("updateDeviceOrGateway", { "message": "result", "data": result });
                        // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Device/Gateway updated.", jobId, company_id)
                        resolve(result)
                    }).catch(err => {
                        console.log("error in updateDeviceOrGateway", err)
                        Logger.error("Error ", { "error": "error in updateDeviceOrGateway" }, err)
                        // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, { err: err.toString() }, "Device/Gateway update Error.", jobId, company_id)
                        reject(err)
                    })
                } else {
                    // console.log("--->No changes", values, result.dataValues, device_code)
                    resolve(result)
                }
            } else {
                resolve(result)
            }
        }).catch(err => {
            console.log("error in updateDeviceOrGateway 280", err)
            Logger.error("Error ", { "error": "error in updateDeviceOrGateway" }, err)
            // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, { err: err.toString() }, "Device/Gateway update Error.", jobId, company_id)
            reject(err)
        })

    })
}
//add device or gateway
var addDeviceOrGateway = async function (values, jobId) {
    return new Promise(async (resolve, reject) => {

        var params = {
            thingName: values.device_code, /* required */
        };
        // console.log("🚀 ~ returnnewPromise ~ params: addDeviceOrGateway 254", params)
        const company_id = values.company_id;
        // add code here for check shadow
        // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, values, "Started, getting shadow.", jobId, company_id)
        const getShadowData = await CommunicateWithAwsIotService.communicateWithAwsIot(params, company_id, 'getThingShadow');

        if (getShadowData) {

            var deviceCodeSplitArray = values.device_code.split('-')
            var thingGroupName = 'Gateway-' + deviceCodeSplitArray[1]
            var params = {
                thingGroupName
            };
            // console.log("🚀 ~ returnnewPromise ~ params: addDeviceOrGateway 267", params)
            const getGatewayThings = await CommunicateWithAwsIotService.communicateWithAwsIot(params, company_id, 'listThingsInThingGroup')
                .then(data => { return (data) })
                .catch(err => { reject(err) });
            if (getGatewayThings || deviceCodeSplitArray.length == 2) {
                if ((getGatewayThings && (!getGatewayThings.things || getGatewayThings.things.length == 0)) && deviceCodeSplitArray.length > 2) {
                    // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, values, "listThingsInThingGroup returns empty list", jobId, company_id)
                    reject({});
                } else {
                    if ((getGatewayThings && getGatewayThings.things.length > 0 && getGatewayThings.things.includes(values.device_code)) || deviceCodeSplitArray.length == 2) {
                        // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, values, "Found the shadow.", jobId, company_id)
                        // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, values, "Starting getting cache details.", jobId, company_id)
                        // var cacheData = await getOneFromCache("DeleteDevice", values.device_code)
                        var device = await models.devices.findOne({
                            where: {
                                device_code: values.device_code
                            }
                        }).catch(err => {
                            reject(err)
                        });
                        if (!device) {
                            // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, cacheData, "Not Found the cache.", jobId, company_id)
                            await models.devices.create(values).then(result => {
                                // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, cacheData, "Device created.", jobId, company_id)
                                resolve(result)
                            }).catch(async err => {

                                if (err && err.name != 'SequelizeUniqueConstraintError') {
                                    reject(err);
                                } else {
                                    var getDevice = await models.devices.findOne({
                                        where: {
                                            device_code: values.device_code
                                        }
                                    }).catch(err => {
                                        reject(err);
                                    });
                                    // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, cacheData, "Device error.", jobId, company_id)
                                    resolve(getDevice);
                                }
                            })
                        } else {
                            // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, cacheData, "Found the cache.", jobId, company_id)
                            reject({});
                        }
                    } else {

                        // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, values, "Device Not Found in listThingsInThingGroup.", jobId, company_id)
                        reject({});
                    }
                }
            }
        }
        else {
            // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, values, "Not found the shadow.", jobId, company_id)
            Logger.info("-NotCreated", { "message": "device_code not found in shadow ", "data": values.device_code });
            resolve();
        }
    })
}

const generateUpdateQuery = (fields, exp) => {
    Object.entries(fields).forEach(([key, item]) => {
        exp.UpdateExpression += ` #${key} = :${key},`;
        exp.ExpressionAttributeNames[`#${key}`] = key;
        exp.ExpressionAttributeValues[`:${key}`] = item;
    });
    exp.UpdateExpression = exp.UpdateExpression.slice(0, -1);
    return exp;
};


var manageGateway = function (devicesData, gatewayCode, device_code, company_id, jobId) {
    return new Promise((resolve, reject) => {
        // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Inside manageGateway function.", jobId, company_id)
        // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Check gateway exists.", jobId, company_id)
        //check gateway exists
        checkDeviceOrGatewayExists(device_code, company_id).then(result => {

            //if exists update
            if (result) {
                // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Gateway found, proceeding to update it.", jobId, company_id)

                updateDeviceOrGateway(devicesData, device_code, company_id, jobId)
                    .then(result => {
                        // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Successfully updated the device.", jobId, company_id)
                        // updateJob("Finished", jobId)
                        resolve(result)
                    }).catch(err => {
                        reject(err)
                    })
            } else { //if not create gateway
                const splitArr = gatewayCode.split('-');
                devicesData.name = `[ ${splitArr[1]} ]`;
                devicesData.type = 'gateway';
                devicesData.status = "online";
                devicesData.device_code = device_code;
                devicesData.company_id = company_id;
                // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Gayeway not found, proceeding to create it.", jobId, company_id)

                addDeviceOrGateway(devicesData, jobId)
                    .then(result => {
                        // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "SuccessFully created gateway.", jobId, company_id)
                        var obj = {
                            new: result,
                            old: {}
                        }
                        updateJob("Finished", jobId)
                        if (result && result.id) {
                            addActivityLog(Entities.devices.entity_name, Entities.devices.event_name.gateway_added, obj, Entities.notes.event_name.added, result.id, company_id)
                        }
                        resolve(result)
                    }).catch(err => {
                        // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, { err: err.toString() }, "Error while creating gateway.", jobId, company_id)
                        updateJob("Failed", jobId)
                        reject(err)
                    })
            }
        }).catch(err => {
            reject(err)
        })
    })
}
var manageDevice = function (devicesData, gatewayCode, device_code, company_id, jobId) {
    return new Promise((resolve, reject) => {
        // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Inside manageDevice function.", jobId, company_id)
        // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Check device exists.", jobId, company_id)
        //check device exists
        checkDeviceOrGatewayExists(device_code, company_id).then(result => {

            //if exists  update device
            if (result) {
                if (gatewayCode) {


                    //  addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Check gateway exists or not.", jobId, company_id)
                    checkDeviceOrGatewayExists(gatewayCode, company_id).then(result => {
                        if (result) {
                            // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Gateway exists,updateing gateway_id.", jobId, company_id)
                            devicesData.gateway_id = result.id
                        }

                        // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Device found, proceeding to update it.", jobId, company_id)
                        updateDeviceOrGateway(devicesData, device_code, company_id, jobId)
                            .then(result => {
                                // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Successfully updated the device.", jobId, company_id)
                                // updateJob("Finished", jobId)
                                resolve(result)
                            }).catch(err => {
                                reject(err)
                            })
                    }).catch(err => {
                        reject(err)
                    })
                } else {
                    if (!devicesData.mac_address) {
                        var splitt = device_code.split('-')
                        devicesData.mac_address = splitt[1]
                    }
                    updateDeviceOrGateway(devicesData, device_code, company_id, jobId)
                        .then(result => {
                            // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Successfully updated the device.", jobId, company_id)
                            // updateJob("Finished", jobId)
                            resolve(result)
                        }).catch(err => {
                            reject(err)
                        })
                }


                //Disabled gateway update while updating device, because sometimes device update info come late ,then wrong info will get store.
                // var gatewayData = {}
                // gatewayData.status = "online"
                // updateDeviceOrGateway(gatewayData, gatewayCode, company_id)
                //     .then(result => {
                //         // resolve(result)
                //     }).catch(err => {
                //         // reject(err)
                //     })
            } else { //if not create device
                // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Device not found, proceeding to create it.", jobId, company_id)
                //check gateway exists
                // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Checking gateway exists.", jobId, company_id)
                if (gatewayCode) {
                    checkDeviceOrGatewayExists(gatewayCode, company_id)
                        .then(result => {

                            //if exists  add device using gateway_id
                            if (result || (!result && gatewayCode == null)) {
                                //  addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Gateway found, proceeding to create device.", jobId, company_id)
                                devicesData.gateway_id = (result) ? result.id : null;
                                devicesData.device_code = device_code;
                                devicesData.company_id = company_id;
                                devicesData.is_manually_added = result && result.is_manually_added ? result.is_manually_added : false;
                                devicesData.location_id = (result && result.location_id) ? result.location_id : null;
                                //  addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Started creating device.", jobId, company_id)

                                addDeviceOrGateway(devicesData, jobId)
                                    .then(result => {
                                        // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "SuccessFully created device.", jobId, company_id)
                                        var obj = {
                                            new: result,
                                            old: {}
                                        }

                                        // updateJob("Finished", jobId)
                                        if (result && result.id) {
                                            addActivityLog(Entities.devices.entity_name, Entities.devices.event_name.device_added, obj, Entities.notes.event_name.added, result.id, company_id)
                                        }
                                        resolve(result)
                                    }).catch(err => {
                                        // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, { err: err.toString() }, "Error while creating device.", jobId, company_id)
                                        // updateJob("Failed", jobId)
                                        reject(err)
                                    })
                            } else {
                                // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Gateway not found, proceeding to create gateway.", jobId, company_id)
                                //if not create gateway
                                const splitArr = gatewayCode.split('-');
                                var gatewayData = {}
                                gatewayData.name = `[ ${splitArr[1]} ]`;
                                gatewayData.type = 'gateway';
                                gatewayData.device_code = gatewayCode
                                gatewayData.company_id = company_id
                                gatewayData.status = "online"
                                gatewayData.mac_address = splitArr[1]
                                //  addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, gatewayData, "Started creating gateway.", jobId, company_id)

                                addDeviceOrGateway(gatewayData, jobId)
                                    .then((result) => {
                                        //  addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Successfully created gateway.", jobId, company_id)
                                        var obj = {
                                            new: result,
                                            old: {}
                                        }
                                        if (result && result.id) {
                                            addActivityLog(Entities.devices.entity_name, Entities.devices.event_name.gateway_added, obj, Entities.notes.event_name.added, result.id, company_id)
                                            //add device using gateway_id
                                            devicesData.gateway_id = result.id;
                                            devicesData.device_code = device_code;
                                            devicesData.company_id = company_id;
                                            // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Started creating device.", jobId, company_id)

                                            addDeviceOrGateway(devicesData, jobId)
                                                .then((result) => {
                                                    var obj = {
                                                        new: result,
                                                        old: {}
                                                    }
                                                    // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Successfully created device.", jobId, company_id)
                                                    // updateJob("Finished", jobId)
                                                    if (result && result.id) {
                                                        addActivityLog(Entities.devices.entity_name, Entities.devices.event_name.device_added, obj, Entities.notes.event_name.added, result.id, company_id)
                                                    }
                                                    resolve(result)
                                                }).catch(err => {
                                                    // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, { err: err.toString() }, "Error while creating device.", jobId, company_id)
                                                    // updateJob("Failed", jobId)
                                                    reject(err)
                                                })
                                        }
                                    }).catch(err => {
                                        // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, { err: err.toString() }, "Error while creating device.", jobId, company_id)
                                        // updateJob("Failed", jobId)
                                        reject(err)
                                    })
                            }

                        })
                        .catch(err => {
                            reject(err)
                        })
                } else {
                    devicesData.gateway_id = null;
                    devicesData.device_code = device_code;
                    devicesData.company_id = company_id;
                    // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Started creating device.", jobId, company_id)

                    addDeviceOrGateway(devicesData, jobId)
                        .then((result) => {
                            var obj = {
                                new: result,
                                old: {}
                            }
                            // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, result, "Successfully created device.", jobId, company_id)
                            // updateJob("Finished", jobId)
                            if (result && result.id) {
                                addActivityLog(Entities.devices.entity_name, Entities.devices.event_name.device_added, obj, Entities.notes.event_name.added, result.id, company_id)
                            }
                            resolve(result)
                        }).catch(err => {
                            // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, { err: err.toString() }, "Error while creating device.", jobId, company_id)
                            // updateJob("Failed", jobId)
                            reject(err)
                        })

                }
            }
        }).catch(err => {
            reject(err)
        })
    })
}
function manage(obj, pointer, jobId) {
    return new Promise(async (resolve, reject) => {
        var devicesData = obj.data
        var gatewayCode = obj.gateway
        if (!companyId) {
            const company = await getCompany(null, process.env.COMPANY_CODE).then(result => {
                return (result);
            }).catch(err => {
                reject(err);
            });
            companyId = company.id;
        }
        // if (!jobId) {
        //     var job = await createJob("addDeviceJob", "Started", {
        //         deviceCode: devicesData.device_code
        //     }, companyId).catch(err => {
        //         reject(err)
        //     })
        //     jobId = job.id
        // }
        const where = {};
        where.device_code = devicesData.device_code;
        where.company_id = companyId || null;
        // devicesData.company_id = companyId
        // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Inside manage function", jobId, companyId)


        if (devicesData.type && devicesData.type == 'gateway') {
            // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Device type is gateway", jobId, companyId)

            manageGateway(devicesData, gatewayCode, devicesData.device_code, companyId, jobId).then(result => {
                //  updateJob("Finished", jobId)
                resolve(result)
            }).catch(err => {
                //   updateJob("Failed", jobId)
                reject(err)
            })
        } else {

            const coordinatorModels = process.env.COORDINATOR_MODEL_LIST;
            if (devicesData.model.toUpperCase().endsWith('ZC') || (coordinatorModels && coordinatorModels.includes(devicesData.model.toUpperCase()))) {
                //  addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Device type is coordinator_device,proceeding to update the gateway name", jobId, companyId)

                devicesData.type = 'coordinator_device';
                if (devicesData.name) {
                    let values = {
                        name: devicesData.name,
                    }
                    updateDeviceOrGateway(values, gatewayCode, companyId, jobId).then(result => {
                        //  updateJob("Finished", jobId)
                        resolve(result)
                    }).catch(err => {
                        //    updateJob("Failed", jobId)
                        reject(err);
                    })
                }
            }
            //   addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, devicesData, "Device type is normal device", jobId, companyId)
            manageDevice(devicesData, gatewayCode, devicesData.device_code, companyId, jobId).then(result => {
                //   updateJob("Finished", jobId)
                resolve(result)
            }).catch(err => {
                //  addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, { err: err.toString() }, "job failed", jobId, companyId)

                //   updateJob("Failed", jobId)
                reject(err)
            })


        }
    })
}

function addDeviceAlert(alert_type, alert_code, device_id, company_id) {
    return new Promise(async (resolve, reject) => {
        var device_alert = await models.device_alerts.findOne({
            where: {
                alert_code, device_id, company_id
            }
        }).then(result => { return result })
            .catch(err => {
                reject(err)
            })
        if (!device_alert) {
            await models.device_alerts.create({
                alert_type, alert_code, device_id, company_id, severity: 'low'
            }).then(result => {
                resolve(result)
            }).catch(err => {
                reject(err)
            })
        } else {
            resolve()
        }


    })
}
function removeDeviceAlert(alert_type, alert_code, device_id, company_id) {
    return new Promise((resolve, reject) => {
        models.device_alerts.destroy({
            where: {
                device_id, alert_code, company_id
            }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

function getDeviceAlerts(device_id) {
    return new Promise((resolve, reject) => {
        models.device_alerts.findAll({
            where: {
                device_id
            }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

function manageLowBatteryAlert(property_name, value, deviceCode, companyId, model) {
    return new Promise(async (resolve, reject) => {
        var device = await checkDeviceOrGatewayExists(deviceCode, companyId)
            .catch(err => {
                reject(err);
            })
        if (device) {
            let device_id = device.id
            let alert_code = "ErrorPowerSLowBattery"
            var bits = convertDecimalToBinary(parseInt(value), 8)

            if (bits[0] == 1) {
                await addDeviceAlert(alert_code, alert_code, device_id, companyId).then(result => { result })
                    .catch(err => {
                        reject(err);
                    })

                const object = {
                    alert_type: alert_code,
                    device_id,
                };
                await alertCommunicationConfig(object).then(result => { result })
                    .catch(err => {
                        reject(err);
                    });

            } else {
                await removeDeviceAlert(alert_code, alert_code, device_id, companyId).then(result => { result })
                    .catch(err => {
                        reject(err);
                    })

            }
        }
        resolve();
    })

}

function managePurmoLowBatteryAlert(property_name, value, deviceCode, companyId, model) {
    return new Promise(async (resolve, reject) => {
        var device = await checkDeviceOrGatewayExists(deviceCode, companyId)
            .catch(err => {
                reject(err);
            })
        if (device) {
            let device_id = device.id
            let key = 'background_server_constants';
            let backgroundServerConstants = await Constant(key)
            let ErrorPowerSLowBattery_purmo_model_list = backgroundServerConstants["purmo_low_battery_devices"] || []
            if (process.env.COMPANY_CODE === 'purmo' && ErrorPowerSLowBattery_purmo_model_list.includes(model) === true) {
                let alert_code = "ErrorPowerSLowBattery"
                // let nameSplit = property_name.split(':')
                // if (nameSplit.length == 3) {
                //     alert_code = nameSplit[2]
                // }

                var bits = convertDecimalToBinary(parseInt(value), 8)
                if (bits[0] == 1) {
                    await addDeviceAlert(alert_code, alert_code, device_id, companyId).then(result => { result })
                        .catch(err => {
                            reject(err);
                        })
                    // const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
                    // const splitArr = deviceCode.split('-');
                    // const gateway = `${splitArr[0]}-${splitArr[1]}`;
                    // let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": true, "eventTime": formattedDateTime } }
                    // publishSyncBlockProperty(companyId, gateway, defaultValue).catch(err => { })

                    const object = {
                        alert_type: alert_code,
                        device_id,
                    };
                    await alertCommunicationConfig(object).then(result => { result })
                        .catch(err => {
                            reject(err);
                        });

                } else {
                    await removeDeviceAlert(alert_code, alert_code, device_id, companyId).then(result => { result })
                        .catch(err => {
                            reject(err);
                        })
                    // const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
                    // const splitArr = deviceCode.split('-');
                    // const gateway = `${splitArr[0]}-${splitArr[1]}`;
                    // let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": true, "eventTime": formattedDateTime } }
                    // publishSyncBlockProperty(companyId, gateway, defaultValue).catch(err => { })

                }
            }
        }
        resolve();
    })

}

function managePurmoDeviceErrorcode(property_name, value, deviceCode, companyId, model) {
    return new Promise(async (resolve, reject) => {
        //Added logic as per the application
        var device = await checkDeviceOrGatewayExists(deviceCode, companyId)
            .catch(err => {
                reject(err);
            })
        if (device) {
            let device_id = device.id
            let key = 'background_server_constants';
            let backgroundServerConstants = await Constant(key)
            let ErrorPowerSLowBattery_purmo_model_list = backgroundServerConstants["purmo_deviceerrorcode_devices"] || []
            if (process.env.COMPANY_CODE === 'purmo' && ErrorPowerSLowBattery_purmo_model_list.includes(model) === true) {
                let alert_code = "DeviceErrorCode"
                var substring = value.substring(0, 2)
                var bits = convertDecimalToBinary(parseInt(substring), 8)
                if (bits[0] == 1 || bits[1] == 1) {
                    await addDeviceAlert(alert_code, alert_code, device_id, companyId).then(result => { result })
                        .catch(err => {
                            reject(err);
                        })
                } else if (bits[0] == 0 && bits[1] == 0) {
                    await removeDeviceAlert(alert_code, alert_code, device_id, companyId).then(result => { result })
                        .catch(err => {
                            reject(err);
                        })
                }
            }
        }
        resolve();
    })

}

function manageEventTimeout(createTime, event_timeout, object) {
    return new Promise(async (resolve, reject) => {
        try {
            let currentTime = new Date();
            let timeDiff = currentTime - createTime;
            let timeout = event_timeout || 3600000;
            if (timeDiff <= timeout) {
                console.log("new event")
                await alertCommunicationConfig(object).then(result => { result })
                    .catch(err => {
                        reject(err);
                    });
            }else{
                console.log("old event")
            }
            resolve();
        }
        catch (err) {
            reject(err);
        }
    });
}


function isChangedEvent(deviceCode, propertyName, currentValue,parsedAt) {
    return new Promise(async (resolve, reject) => {
        console.log("🚀 ~ isChangedEvent ~ deviceCode, propertyName, currentValue,parsedAt:", deviceCode, propertyName, currentValue,parsedAt)
        // let deviceEventsCache = await getOneFromCache(deviceCode, propertyName)
        // if (deviceEventsCache) {
        //     console.log("🚀 ~ returnnewPromise ~ deviceEventsCache:", deviceEventsCache)
        //     resolve(deviceEventsCache.value.isChanged)
        // } else {
            let categorya_enabled = process.env.CATEGORYA_ENABLED;
            console.log("🚀 ~ returnnewPromise ~ categorya_enabled:", categorya_enabled)
            let categoryb_enabled = process.env.CATEGORYB_ENABLED;
            console.log("🚀 ~ returnnewPromise ~ categoryb_enabled:", categoryb_enabled)
            let deviceEvents = null;

            if ((categorya_enabled == true || categorya_enabled == 'true')) {
                console.log("🚀 ~ returnnewPromise ~ categorya_enabled:", categorya_enabled)
                deviceEvents = await models.device_events.findOne({
                        where: {
                            device_code: deviceCode,
                            property_display_name: propertyName,
                            parsed_at:{
                                [Op.ne]:parsedAt
                            }
                        },
                        order: [['event_at', 'DESC']],
                    }
                ).catch(err => {
                    reject(err);
                });
                console.log("🚀 ~ returnnewPromise ~ deviceEvents:", deviceEvents)
            } else if ((categoryb_enabled == true || categoryb_enabled == 'true')) {
                console.log("🚀 ~ returnnewPromise ~ categoryb_enabled:", categoryb_enabled)
                deviceEvents = await categoryb_models.device_events.findOne({
                        where: {
                            device_code: deviceCode,
                            property_display_name: propertyName,
                        },
                        order: [['event_at', 'DESC']],
                    }
                ).catch(err => {
                    reject(err);
                });
                console.log("🚀 ~ returnnewPromise ~ deviceEvents:", deviceEvents)
            }

            if (deviceEvents) {
                
                if (deviceEvents.value.new != currentValue) {
                    console.log("isChangedEvents deviceEvents are different ",true,deviceEvents.value.new,currentValue)
                    resolve(true)
                }else {
                    console.log("isChangedEvents deviceEvents are same ",true,deviceEvents.value.new,currentValue)
                    resolve(false)
                }
            } else {
                console.log("isChangedEvents deviceEvents not found ",true)
                resolve(true)
            }
        // }
    });
}


function deviceAlerts(obj, alert_codes, device_id, company_id, model, deviceCode) {
    return new Promise(async (resolve, reject) => {
        let parsedAt = new Date(obj["parsedAt"]);
        const company = await getCompany(company_id, null).then(result => {
            return (result);
        }).catch(err => {
            reject(err);
        });

        let old = obj

        let currentObj = obj
        // delete old.current
        for (const alert_code of alert_codes) {
            let alertCodes = Object.keys(currentObj).filter((name) => {
                if (name.includes(':')) {
                    var nameSplit = name.split(':')
                    // console.log("🚀 ~ file: DeviceUpdateHandler.js:866 ~ nameSplit:", nameSplit)
                    if (nameSplit.length == 3 && nameSplit[2] == alert_code) {
                        return name
                    }
                } else {
                    return name.endsWith(alert_code)
                }
            });
            if (alertCodes && alertCodes.length > 0) {
                let deviceAlerts = await getDeviceAlerts(device_id).catch(err => {
                    reject(err)
                })
                let alertCodeList = lodash.map(deviceAlerts, (element => { return element.alert_type }))
                for (let index = 0; index < alertCodes.length; index++) {

                    let alertCodeKey = alertCodes[index]
                    let alert_type = alert_code
                    let key = 'background_server_constants';
                    let backgroundServerConstants = await Constant(key)
                    let ErrorPowerSLowBattery_purmo_model_list = backgroundServerConstants["purmo_low_battery_devices"] || []
                    if ((currentObj[alertCodeKey] == 0 && alert_type != 'connected') || ((currentObj[alertCodeKey] == 'true' || currentObj[alertCodeKey] == true) && alert_type == 'connected')) {
                        var emailKey = alert_type + "_" + device_id + "_email"
                        var smsKey = alert_type + "_" + device_id + "_sms"
                        var notificationKey = alert_type + "_" + device_id + "_notification"
                        // await deleteFromCache("AlertHistory", emailKey)
                        // await deleteFromCache("AlertHistory", smsKey)
                        // await deleteFromCache("AlertHistory", notificationKey)
                        if (alert_type == 'ErrorPowerSLowBattery') {
                            if (ErrorPowerSLowBattery_purmo_model_list.includes(model) === true && process.env.COMPANY_CODE === 'purmo') {
                            }
                            else {
                                await removeDeviceAlert(alert_type, alert_code, device_id, company_id).then(result => { result })
                                    .catch(err => {
                                        reject(err);
                                    })
                                // const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
                                // const splitArr = deviceCode.split('-');
                                // const gateway = `${splitArr[0]}-${splitArr[1]}`;
                                // let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": true, "eventTime": formattedDateTime } }
                                // if (alertCodeList.includes(alert_type)) {
                                //     publishSyncBlockProperty(company_id, gateway, defaultValue).catch(err => { })
                                // }

                            }
                        }
                        else {
                            await removeDeviceAlert(alert_type, alert_code, device_id, company_id).then(result => { result })
                                .catch(err => {
                                    reject(err);
                                })
                            // const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
                            // const splitArr = deviceCode.split('-');
                            // const gateway = `${splitArr[0]}-${splitArr[1]}`;
                            // let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": true, "eventTime": formattedDateTime } }
                            // if (alertCodeList.includes(alert_type)) {
                            //     publishSyncBlockProperty(company_id, gateway, defaultValue).catch(err => { })
                            // }
                        }
                    } else if ((currentObj[alertCodeKey] == 1 && alert_type != 'connected') || ((currentObj[alertCodeKey] == 'false'|| currentObj[alertCodeKey] == false) && alert_type == 'connected')  || (currentObj[alertCodeKey] != 0 && alert_type == 'ErrorLossLinkStatus')) {
                        // if (currentObj[alertCodeKey] != old[alertCodeKey]) {
                        if (alert_type == 'ErrorPowerSLowBattery') {
                            if (ErrorPowerSLowBattery_purmo_model_list.includes(model) === false && process.env.COMPANY_CODE === 'purmo') {

                            }
                            else {
                                 const errorAlarmstate = Object.keys(currentObj).filter((name) => name.endsWith(":ErrorBatteryAlarmState_d"))
                                 if (currentObj[errorAlarmstate] != 0 || company.alert_configs.skip_checking_error_alarm_state_d == true) {
                                     var bits = convertDecimalToBinary(parseInt(currentObj[errorAlarmstate]), 8)
                                     if ((bits[0] == 1) || company.alert_configs.skip_checking_error_alarm_state_d == true) {
                                        if (process.env.COMPANY_CODE !== 'purmo') {

                                            await addDeviceAlert(alert_type, alert_code, device_id, company_id).then(result => { result })
                                                .catch(err => {
                                                    reject(err);
                                                })
                                            const object = {
                                                alert_type,
                                                device_id,
                                            };
                                            if (company.alert_configs.send_alert_only_for_changed === true) {
                                                if (await isChangedEvent(deviceCode, alert_type, currentObj[alertCodeKey],parsedAt) === true) {
                                                    await manageEventTimeout(parsedAt, company.alert_configs.event_timeout, object).catch(err => {
                                                        reject(err);
                                                    });
                                                }
                                            } else {
                                                await manageEventTimeout(parsedAt, company.alert_configs.event_timeout, object).catch(err => {
                                                    reject(err);
                                                });
                                            }
                                        }
                                    }
                                 }
                            }
                        }
                        else if (alert_type == 'ErrorLossLinkStatus' &&  process.env.COMPANY_CODE === 'purmo') {
                            if (process.env.COMPANY_CODE === 'purmo') {
                                var params = {
                                    thingName: deviceCode, /* required */
                                };
                                // console.log("🚀 ~ returnnewPromise ~ params: deviceAlerts 800", params)
                                let getShadowData = await CommunicateWithAwsIotService.communicateWithAwsIot(params, company_id, 'getThingShadow');
                                // console.log("🚀 ~ file: DeviceUpdateHandler.js:745 ~ returnnewPromise ~ getShadowData:", getShadowData)
                                if (getShadowData) {
                                    // gateway shadow not updated
                                    var payload = JSON.parse(getShadowData.payload);
                                    const { reported } = payload.state; // array
                                    // console.log("🚀 ~ file: DeviceUpdateHandler.js:750 ~ returnnewPromise ~ alertCodeKey:", alertCodeKey)
                                    var bits = convertDecimalToBinary(parseInt(currentObj[alertCodeKey]), 32)
                                    // console.log("🚀 ~ file: DeviceUpdateHandler.js:752 ~ returnnewPromise ~ bits:", bits)
                                    let bitIndex = 0;
                                    for (let index = 0; index < bits.length; index++) {
                                        const element = bits[index];
                                        if (element == 1) {
                                            bitIndex = index;
                                        }
                                    }
                                    let ep = alertCodeKey.split(':')
                                    ep = ep[0]
                                    let bindingList = null;
                                    if (bitIndex < 6) {
                                        Object.keys(reported).forEach(async (key) => {
                                            if (reported[key].hasOwnProperty('properties')) {
                                                const { properties } = reported[key];
                                                base_key = key;
                                                if (Object.keys(properties).length > 0) {
                                                    // console.log("🚀 ~ file: DeviceUpdateHandler.js:769 ~ Object.keys ~ properties:", properties)
                                                    bindingList = Object.keys(properties).filter((name) => name.endsWith(`${ep}:sBindS:BindingList1`));
                                                    bindingList = properties[bindingList];
                                                    // console.log("🚀 ~ file: DeviceUpdateHandler.js:772 ~ Object.keys ~ bindingList:", bindingList)
                                                }
                                            }
                                        });
                                    } else if (bitIndex > 5 && bitIndex < 12) {
                                        Object.keys(reported).forEach(async (key) => {
                                            if (reported[key].hasOwnProperty('properties')) {
                                                const { properties } = reported[key];
                                                base_key = key;
                                                if (Object.keys(properties).length > 0) {
                                                    // console.log("🚀 ~ file: DeviceUpdateHandler.js:782 ~ Object.keys ~ properties:", properties)
                                                    bindingList = Object.keys(properties).filter((name) => name.endsWith(`${ep}:sBindS:BindingList2`));
                                                    bindingList = properties[bindingList];
                                                    // console.log("🚀 ~ file: DeviceUpdateHandler.js:785 ~ Object.keys ~ bindingList:", bindingList)
                                                }
                                            }
                                        });
                                    } else if (bitIndex > 11 && bitIndex < 18) {
                                        Object.keys(reported).forEach(async (key) => {
                                            if (reported[key].hasOwnProperty('properties')) {
                                                const { properties } = reported[key];
                                                base_key = key;
                                                if (Object.keys(properties).length > 0) {
                                                    // console.log("🚀 ~ file: DeviceUpdateHandler.js:795 ~ Object.keys ~ properties:", properties)
                                                    bindingList = Object.keys(properties).filter((name) => name.endsWith(`${ep}:sBindS:BindingList3`));
                                                    bindingList = properties[bindingList];
                                                    // console.log("🚀 ~ file: DeviceUpdateHandler.js:798 ~ Object.keys ~ bindingList:", bindingList)
                                                }
                                            }
                                        });
                                    }
                                    let chunkSize = 18;
                                    let devices = [];
                                    for (let i = 0; i < bindingList.length; i += chunkSize) {
                                        let macChunkSize = 2;
                                        bindingRawCode = bindingList.slice(i, i + chunkSize)
                                        bindingCode = bindingRawCode.slice(0, -2);
                                        bindingCode = bindingCode.split("").reverse().join("");
                                        finalDeviceMac = ""
                                        for (let i = 0; i < bindingCode.length; i += macChunkSize) {
                                            split = bindingCode.slice(i, i + macChunkSize)
                                            finalDeviceMac = finalDeviceMac + split.split("").reverse().join("");
                                        }
                                        devices.push(finalDeviceMac);
                                    }
                                    // console.log("Binding devices", deviceCode, devices)
                                    // console.log("Binding bit index ", bitIndex)
                                    var lostDevice = await models.devices.findOne({
                                        where: {
                                            device_code: deviceCode
                                        }
                                    }).then(result => {
                                        return (result)
                                    }).catch(err => {
                                        reject(err)
                                    })
                                    let bindingDevice = devices[bitIndex]
                                    let where = {
                                        device_code: {
                                            [Op.iLike]: `%${bindingDevice}%`,
                                        }
                                    }
                                    if(lostDevice && lostDevice.gateway_id){
                                        where = {
                                            [Op.and]:[
                                               { 
                                                device_code: {
                                                    [Op.iLike]: `%${bindingDevice}%`,
                                                }
                                                },{
                                                    gateway_id : lostDevice.gateway_id
                                                }
                                            ]
                                            
                                        }
                                    }
                                    
                                    var device = await models.devices.findOne({
                                        where
                                    }).then(result => {
                                        return (result)
                                    }).catch(err => {
                                        reject(err)
                                    })
                                    if (device && bindingDevice != '0000000000000000') {
                                        const object = {
                                            alert_type,
                                            device_id,
                                            binding_device_code: device.device_code,
                                            binding_device_name: device.name,
                                        };
                                        // console.log("🚀 ~ file: DeviceUpdateHandler.js:921 ~ returnnewPromise ~ object:", object)

                                        if (company.alert_configs.send_alert_only_for_changed === true) {
                                            if (await isChangedEvent(deviceCode, alert_type, currentObj[alertCodeKey],parsedAt) === true) {
                                                await manageEventTimeout(parsedAt, company.alert_configs.event_timeout, object).catch(err => {
                                                    reject(err);
                                                });
                                            }
                                        } else {
                                            await manageEventTimeout(parsedAt, company.alert_configs.event_timeout, object).catch(err => {
                                                reject(err);
                                            });
                                        }
                                    }
                                }
                            }
                        }
                        // else if (alert_type == 'ErrorPowerSLowBattery') {
                        //     const errorAlarmstate = Object.keys(currentObj).filter((name) => name.endsWith(":ErrorBatteryAlarmState_d"))
                        //     var bits = convertDecimalToBinary(parseInt(currentObj[errorAlarmstate]), 8)
                        //     if (bits[0] == 1 || company.alert_configs.skip_checking_error_alarm_state_d == true) {
                        //         await addDeviceAlert(alert_type, alert_code, device_id, company_id).catch(err => {
                        //             reject(err);
                        //         })

                        //         const object = {
                        //             alert_type,
                        //             device_id,
                        //         };

                        //         if (company.alert_configs.send_alert_only_for_changed === true) {
                        //             if (await isChangedEvent(deviceCode, alert_type, currentObj[alertCodeKey],parsedAt) === true) {
                        //                 await manageEventTimeout(parsedAt, company.alert_configs.event_timeout, object).catch(err => {
                        //                     reject(err);
                        //                 });
                        //             }
                        //         } else {
                        //         await manageEventTimeout(parsedAt, company.alert_configs.event_timeout, object).catch(err => {
                        //             reject(err);
                        //         });
                        //     }

                        //     }
                        // }
                        else {
                            let cacheKey = 'categories';
                            var categories = await getOneFromCache(cacheKey, model)
                            if (!categories) {
                                categories = await models.categories.findOne({
                                    where: {
                                        model
                                    }
                                }).then(result => { return result })
                                    .catch(err => {
                                        reject(err)
                                    });
                                await setInCache(cacheKey, model, { categories });
                                categories = await getOneFromCache(cacheKey, model)
                            }

                            if (categories && categories.categories) {
                                if (categories.categories.data) {
                                    let skipAlertArray = (categories.categories.data.skip_alert_properties) ? categories.categories.data.skip_alert_properties : [];

                                    if (skipAlertArray && skipAlertArray.length > 0) {
                                        if (skipAlertArray.includes(alert_type) !== true) {
                                            await addDeviceAlert(alert_type, alert_code, device_id, company_id).then(result => { result })
                                                .catch(err => {
                                                    reject(err);
                                                })
                                            // const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
                                            // const splitArr = deviceCode.split('-');
                                            // const gateway = `${splitArr[0]}-${splitArr[1]}`;
                                            // let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": true, "eventTime": formattedDateTime } }
                                            // publishSyncBlockProperty(company_id, gateway, defaultValue).catch(err => { })

                                        }
                                    } else {

                                        await addDeviceAlert(alert_type, alert_code, device_id, company_id).then(result => { result })
                                            .catch(err => {
                                                reject(err);
                                            })
                                        // const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
                                        // const splitArr = deviceCode.split('-');
                                        // const gateway = `${splitArr[0]}-${splitArr[1]}`;
                                        // let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": true, "eventTime": formattedDateTime } }
                                        // publishSyncBlockProperty(company_id, gateway, defaultValue).catch(err => { })

                                    }
                                    const object = {
                                        alert_type,
                                        device_id,
                                    };

                                    if (company.alert_configs.send_alert_only_for_changed === true) {
                                        if (await isChangedEvent(deviceCode, alert_type, currentObj[alertCodeKey],parsedAt) === true) {
                                            await manageEventTimeout(parsedAt, company.alert_configs.event_timeout, object).catch(err => {
                                                reject(err);
                                            });
                                        }
                                    } else {
                                    await manageEventTimeout(parsedAt, company.alert_configs.event_timeout, object).catch(err => {
                                        reject(err);
                                    });
                                }
                                } else {
                                    await addDeviceAlert(alert_type, alert_code, device_id, company_id).then(result => { result })
                                        .catch(err => {
                                            reject(err);
                                        });
                                    // const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
                                    // const splitArr = deviceCode.split('-');
                                    // const gateway = `${splitArr[0]}-${splitArr[1]}`;
                                    // let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": true, "eventTime": formattedDateTime } }
                                    // publishSyncBlockProperty(company_id, gateway, defaultValue).catch(err => { })

                                    const object = {
                                        alert_type,
                                        device_id,
                                    };

                                    if (company.alert_configs.send_alert_only_for_changed === true) {
                                        if (await isChangedEvent(deviceCode, alert_type, currentObj[alertCodeKey],parsedAt) === true) {
                                            await manageEventTimeout(parsedAt, company.alert_configs.event_timeout, object).catch(err => {
                                                reject(err);
                                            });
                                        }
                                    } else {
                                    await manageEventTimeout(parsedAt, company.alert_configs.event_timeout, object).catch(err => {
                                        reject(err);
                                    });
                                }
                                }
                            } else {
                                const object = {
                                    alert_type,
                                    device_id,
                                };
                                if (company.alert_configs.send_alert_only_for_changed === true) {
                                    if (await isChangedEvent(deviceCode, alert_type, currentObj[alertCodeKey],parsedAt) === true) {
                                        await manageEventTimeout(parsedAt, company.alert_configs.event_timeout, object).catch(err => {
                                            reject(err);
                                        });
                                    }
                                } else {
                                await manageEventTimeout(parsedAt, company.alert_configs.event_timeout, object).catch(err => {
                                    reject(err);
                                });
                            }
                            }
                        }
                        // }
                    } else {
                        // if (currentObj[alertCodeKey] != old[alertCodeKey]) {
                        if (alert_type == 'SensorErrorStatus') {
                            if ((currentObj[alertCodeKey].length >= 26 && alert_type == 'SensorErrorStatus')) {
                                let value = currentObj[alertCodeKey]
                                let sensorControlBox = value.substring(4, 6)
                                let sensorControlBoxBits = convertDecimalToBinary(sensorControlBox, 8)
                                let sensor1StatusTemp = value.substring(6, 8)
                                let sensor1StatusTempBits = convertDecimalToBinary(sensor1StatusTemp, 8)
                                let sensor2StatusTemp = value.substring(8, 10)
                                let sensor2StatusTempBits = convertDecimalToBinary(sensor2StatusTemp, 8)
                                let sensor3StatusTemp = value.substring(10, 12)
                                let sensor3StatusTempBits = convertDecimalToBinary(sensor3StatusTemp, 8)
                                let sensor4StatusTemp = value.substring(12, 14)
                                let sensor4StatusTempBits = convertDecimalToBinary(sensor4StatusTemp, 8)
                                let sensor5StatusTemp = value.substring(14, 16)
                                let sensor5StatusTempBits = convertDecimalToBinary(sensor5StatusTemp, 8)
                                let sensor6StatusTemp = value.substring(16, 18)
                                let sensor6StatusTempBits = convertDecimalToBinary(sensor6StatusTemp, 8)
                                let sensor7StatusTemp = value.substring(18, 20)
                                let sensor7StatusTempBits = convertDecimalToBinary(sensor7StatusTemp, 8)
                                let sensor8StatusTemp = value.substring(20, 22)
                                let sensor8StatusTempBits = convertDecimalToBinary(sensor8StatusTemp, 8)
                                let sensor9StatusTemp = value.substring(22, 24)
                                let sensor9StatusTempBits = convertDecimalToBinary(sensor9StatusTemp, 8)
                                let remoteControllerStatus = value.substring(24, 26)
                                let remoteControllerStatusBits = convertDecimalToBinary(remoteControllerStatus, 8)

                                if (sensorControlBoxBits[0] == 1 || sensorControlBoxBits[1] == 1) {
                                    //sensor control box alert

                                    await addDeviceAlert(alert_type, alert_code, device_id, company_id).then(result => { result })
                                        .catch(err => {
                                            reject(err);
                                        })
                                    // const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
                                    // const splitArr = deviceCode.split('-');
                                    // const gateway = `${splitArr[0]}-${splitArr[1]}`;
                                    // let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": true, "eventTime": formattedDateTime } }
                                    // publishSyncBlockProperty(company_id, gateway, defaultValue).catch(err => { })

                                }
                                else if (sensor1StatusTempBits[0] == 1 || sensor1StatusTempBits[1] == 1 || sensor1StatusTempBits[2] == 1) {
                                    //sensor 1 alert
                                    await addDeviceAlert(alert_type, alert_code, device_id, company_id).then(result => { result })
                                        .catch(err => {
                                            reject(err);
                                        })
                                    // const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
                                    // const splitArr = deviceCode.split('-');
                                    // const gateway = `${splitArr[0]}-${splitArr[1]}`;
                                    // let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": true, "eventTime": formattedDateTime } }
                                    // publishSyncBlockProperty(company_id, gateway, defaultValue).catch(err => { })

                                }
                                else if (sensor2StatusTempBits[0] == 1 || sensor2StatusTempBits[1] == 1 || sensor2StatusTempBits[2] == 1) {
                                    //sensor 2 alert
                                    await addDeviceAlert(alert_type, alert_code, device_id, company_id).then(result => { result })
                                        .catch(err => {
                                            reject(err);
                                        })
                                    // const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
                                    // const splitArr = deviceCode.split('-');
                                    // const gateway = `${splitArr[0]}-${splitArr[1]}`;
                                    // let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": true, "eventTime": formattedDateTime } }
                                    // publishSyncBlockProperty(company_id, gateway, defaultValue).catch(err => { })

                                }
                                else if (sensor3StatusTempBits[0] == 1 || sensor3StatusTempBits[1] == 1 || sensor3StatusTempBits[2] == 1) {
                                    //sensor 3 alert
                                    await addDeviceAlert(alert_type, alert_code, device_id, company_id).then(result => { result })
                                        .catch(err => {
                                            reject(err);
                                        })
                                    // const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
                                    // const splitArr = deviceCode.split('-');
                                    // const gateway = `${splitArr[0]}-${splitArr[1]}`;
                                    // let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": true, "eventTime": formattedDateTime } }
                                    // publishSyncBlockProperty(company_id, gateway, defaultValue).catch(err => { })

                                }
                                else if (sensor4StatusTempBits[0] == 1 || sensor4StatusTempBits[1] == 1 || sensor4StatusTempBits[2] == 1) {
                                    //sensor 4 alert
                                    await addDeviceAlert(alert_type, alert_code, device_id, company_id).then(result => { result })
                                        .catch(err => {
                                            reject(err);
                                        })
                                    // const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
                                    // const splitArr = deviceCode.split('-');
                                    // const gateway = `${splitArr[0]}-${splitArr[1]}`;
                                    // let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": true, "eventTime": formattedDateTime } }
                                    // publishSyncBlockProperty(company_id, gateway, defaultValue).catch(err => { })

                                }
                                else if (sensor5StatusTempBits[0] == 1 || sensor5StatusTempBits[1] == 1 || sensor5StatusTempBits[2] == 1) {
                                    //sensor 5 alert
                                    await addDeviceAlert(alert_type, alert_code, device_id, company_id).then(result => { result })
                                        .catch(err => {
                                            reject(err);
                                        })
                                    // const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
                                    // const splitArr = deviceCode.split('-');
                                    // const gateway = `${splitArr[0]}-${splitArr[1]}`;
                                    // let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": true, "eventTime": formattedDateTime } }
                                    // publishSyncBlockProperty(company_id, gateway, defaultValue).catch(err => { })

                                }
                                else if (sensor6StatusTempBits[0] == 1 || sensor6StatusTempBits[1] == 1 || sensor6StatusTempBits[2] == 1) {
                                    //sensor 6 alert
                                    await addDeviceAlert(alert_type, alert_code, device_id, company_id).then(result => { result })
                                        .catch(err => {
                                            reject(err);
                                        })
                                    // const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
                                    // const splitArr = deviceCode.split('-');
                                    // const gateway = `${splitArr[0]}-${splitArr[1]}`;
                                    // let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": true, "eventTime": formattedDateTime } }
                                    // publishSyncBlockProperty(company_id, gateway, defaultValue).catch(err => { })

                                }
                                else if (sensor7StatusTempBits[0] == 1 || sensor7StatusTempBits[1] == 1 || sensor7StatusTempBits[2] == 1) {
                                    //sensor 7 alert
                                    await addDeviceAlert(alert_type, alert_code, device_id, company_id).then(result => { result })
                                        .catch(err => {
                                            reject(err);
                                        })
                                    // const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
                                    // const splitArr = deviceCode.split('-');
                                    // const gateway = `${splitArr[0]}-${splitArr[1]}`;
                                    // let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": true, "eventTime": formattedDateTime } }
                                    // publishSyncBlockProperty(company_id, gateway, defaultValue).catch(err => { })

                                }
                                else if (sensor8StatusTempBits[0] == 1 || sensor8StatusTempBits[1] == 1 || sensor8StatusTempBits[2] == 1) {
                                    //sensor 8 alert
                                    await addDeviceAlert(alert_type, alert_code, device_id, company_id).then(result => { result })
                                        .catch(err => {
                                            reject(err);
                                        })
                                    // const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
                                    // const splitArr = deviceCode.split('-');
                                    // const gateway = `${splitArr[0]}-${splitArr[1]}`;
                                    // let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": true, "eventTime": formattedDateTime } }
                                    // publishSyncBlockProperty(company_id, gateway, defaultValue).catch(err => { })

                                }
                                else if (sensor9StatusTempBits[0] == 1 || sensor9StatusTempBits[1] == 1 || sensor9StatusTempBits[2] == 1) {
                                    //sensor 9 alert
                                    await addDeviceAlert(alert_type, alert_code, device_id, company_id).then(result => { result })
                                        .catch(err => {
                                            reject(err);
                                        })
                                    // const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
                                    // const splitArr = deviceCode.split('-');
                                    // const gateway = `${splitArr[0]}-${splitArr[1]}`;
                                    // let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": true, "eventTime": formattedDateTime } }
                                    // publishSyncBlockProperty(company_id, gateway, defaultValue).catch(err => { })

                                }
                                else if (remoteControllerStatusBits[1] == 1) {
                                    //sensor remote controller alert
                                    await addDeviceAlert(alert_type, alert_code, device_id, company_id).then(result => { result })
                                        .catch(err => {
                                            reject(err);
                                        })
                                    // const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
                                    // const splitArr = deviceCode.split('-');
                                    // const gateway = `${splitArr[0]}-${splitArr[1]}`;
                                    // let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": true, "eventTime": formattedDateTime } }
                                    // publishSyncBlockProperty(company_id, gateway, defaultValue).catch(err => { })

                                } else {
                                    //remove alert if not matching
                                    await removeDeviceAlert(alert_type, alert_code, device_id, company_id).then(result => { result })
                                        .catch(err => {
                                            reject(err);
                                        })
                                    // const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
                                    // const splitArr = deviceCode.split('-');
                                    // const gateway = `${splitArr[0]}-${splitArr[1]}`;
                                    // let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": true, "eventTime": formattedDateTime } }
                                    // publishSyncBlockProperty(company_id, gateway, defaultValue).catch(err => { })

                                }



                            } else {
                                //remove alert if not matching
                                await removeDeviceAlert(alert_type, alert_code, device_id, company_id).then(result => { result })
                                    .catch(err => {
                                        reject(err);
                                    })
                                // const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
                                // const splitArr = deviceCode.split('-');
                                // const gateway = `${splitArr[0]}-${splitArr[1]}`;
                                // let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": true, "eventTime": formattedDateTime } }
                                // publishSyncBlockProperty(company_id, gateway, defaultValue).catch(err => { })

                            }
                        } else {
                            continue
                        }
                        // }
                    }

                }
            }
        }
        resolve();
    })
}

function manageDeviceAlerts(currentObj, deviceCode, companyId, model) {
    //Need to check the errors and alerts and store it to respective device_alerts table or need to remove from device_alerts table
    return new Promise(async (resolve, reject) => {
        var device = await checkDeviceOrGatewayExists(deviceCode, companyId)
            .catch(err => {
                reject(err);
            })
        if (device) {
            let key = 'constants'
            let constants = await Constant(key)
            var deviceId = device.id
            deviceAlerts(currentObj, constants.ErrorList, deviceId, companyId, model, deviceCode)
                .then(result => {
                    resolve(result);
                })
                .catch(err => {
                    reject(err);
                });
        }

    })
}
function manageDeviceHistories(obj) {
    return new Promise(async (resolve, reject) => {
        const previous = obj;
        const current = obj.current;
        let model = current.model
        const createdAt = current.createdAt;
        const deviceCode = obj.topic_name;
        let parsedAt = new Date(obj.parsedAt);
        let eventAt = new Date(parseInt(current["timestamp"]) * 1000)
        if (!model) {
            var modelSplit = deviceCode.split('-');
            if (modelSplit.length == 2) {
                model = modelSplit[0]
            } else if (modelSplit.length > 2) {
                model = modelSplit[2]
            }
        }

        const company = await getCompany(null, process.env.COMPANY_CODE).then(result => {
            return (result);
        }).catch(err => {
            reject(err);
        });
        companyId = company.id;
        if (previous.connected != current.connected) {
            let propertyName = "connected";
            let Propertyvalue = current.connected
            let property_endpoint = null;
            let property_display_name = "connected";
            let value = { "new": current.connected, "old": previous.connected }
            // if (current.connected == true || current.connected == 'true') {
            //     if (createdAt) {
            //         eventAt = createdAt;
            //     }
            // }
            let categorya_enabled = process.env.CATEGORYA_ENABLED;
            let categoryb_enabled = process.env.CATEGORYB_ENABLED;
            if ((categorya_enabled == true || categorya_enabled == 'true')) {
                const deviceHistory = await models.device_events.create({
                    device_code: deviceCode,
                    model: model,
                    parsed_at: parsedAt,
                    event_at: eventAt,
                    property_name: propertyName,
                    value,
                    property_endpoint,
                    property_display_name,
                    company_id: companyId,
                }).catch(err => {
                    reject(err);
                })
            }
            if ((categoryb_enabled == true || categoryb_enabled == 'true')) {
                const deviceHistory = await categoryb_models.device_events.create({
                    device_code: deviceCode,
                    model: model,
                    parsed_at: parsedAt,
                    event_at: eventAt,
                    property_name: propertyName,
                    value,
                    property_endpoint,
                    property_display_name,
                    company_id: companyId,
                }).catch(err => {
                    reject(err);
                })
            }
        }
        resolve()

    })
}
const getExpiryTimeUntilEndOfCurrentDay = function () {
    return new Promise((resolve, reject) => {
        const endOfCurrentDay = moment().endOf('day');
        const duration = moment.duration(endOfCurrentDay.diff(moment()));
        const expiryInSeconds = duration.asSeconds();
        resolve(expiryInSeconds);
    });
}
function manageAcceptedDeviceHistories(obj) {
    return new Promise(async (resolve, reject) => {
        var deviceCode = obj.topic_name;
        var model = obj.model;
        var eventAt = new Date(parseInt(obj["timestamp"]) * 1000)
        var createdAt = obj["parsedAt"]
        var parsedAt = new Date(obj["parsedAt"])
        const company = await getCompany(null, process.env.COMPANY_CODE).then(result => {
            return (result);
        }).catch(err => {
            reject(err);
        });
        const companyId = company.id;
        if (!model) {
            var modelSplit = deviceCode.split('-');
            if (modelSplit.length == 2) {
                model = modelSplit[0]
            } else if (modelSplit.length > 2) {
                model = modelSplit[2]
            }
        }
        let cacheKey = 'categories';
        var categories = await getOneFromCache(cacheKey, model)
        if (!categories) {
            categories = await models.categories.findOne({
                where: {
                    model
                }
            }).then(result => { return result })
                .catch(err => {
                    reject(err)
                });
            await setInCache(cacheKey, model, { categories });
            categories = await getOneFromCache(cacheKey, model)
        }

        let categorya_enabled = process.env.CATEGORYA_ENABLED;
        let categoryb_enabled = process.env.CATEGORYB_ENABLED;
        let insertQueryList = []
        let insertQueryListCatB = []
        for (const iterator of Object.keys(obj)) {
            if (!["parsedAt", "createdAt", "timestamp", "metadata", "node_conn", "cloud_conn", "version", "createdAt", "model", "parsedAt", "topic_name"].includes(iterator)) {
                let propertyName = iterator;
                let Propertyvalue = obj[iterator]
                let property_endpoint = propertyName.split(":")[0];
                let property_display_name = propertyName.split(":")[2];
                let value = { "new": Propertyvalue, "old": "", isChanged: false }
                let needToInsert = false
                var deviceEventsCache = await getOneFromCache(deviceCode, propertyName)
                await setInCache(deviceCode, propertyName, { Propertyvalue })
                if (deviceEventsCache) {
                    value.old = deviceEventsCache.Propertyvalue
                    if (deviceEventsCache.Propertyvalue != Propertyvalue) {
                        value.isChanged = true
                        needToInsert = true
                    }
                    if (deviceEventsCache.Propertyvalue == Propertyvalue) {
                        continue
                    }
                } else {
                    let deviceEvents = null
                    if ((categorya_enabled == true || categorya_enabled == 'true')) {
                        deviceEvents = await models.device_events.findOne({
                            where: {
                                device_code: deviceCode,
                                property_name: propertyName,
                            },
                            order: [['updated_at', 'DESC']],
                        }
                        ).catch(err => {
                            reject(err);
                        });
                    } else if ((categoryb_enabled == true || categoryb_enabled == 'true')) {
                        deviceEvents = await categoryb_models.device_events.findOne({
                            where: {
                                device_code: deviceCode,
                                property_name: propertyName,
                            },
                            order: [['updated_at', 'DESC']],
                        }
                        ).catch(err => {
                            reject(err);
                        });
                    }
                    if (deviceEvents) {
                        value.old = deviceEvents.value.new
                        if (deviceEvents.value.new != Propertyvalue) {
                            value.isChanged = true
                            needToInsert = true
                        } else {
                            continue
                       }
                    } else {
                        value.isChanged = true
                        needToInsert = true
                    }
                }

                if (needToInsert == true) {
                if ((categorya_enabled == true || categorya_enabled == 'true')) {
                    insertQueryList.push({
                        device_code: deviceCode,
                        model: model,
                        parsed_at: parsedAt,
                        event_at: eventAt,
                        property_name: propertyName,
                        value,
                        property_endpoint,
                        property_display_name,
                        company_id: companyId,
                    })
                    // const deviceHistory = await models.device_events.create({
                    //     device_code: deviceCode,
                    //     model: model,
                    //     parsed_at: parsedAt,
                    //     event_at: eventAt,
                    //     property_name: propertyName,
                    //     value,
                    //     property_endpoint,
                    //     property_display_name,
                    //     company_id: companyId,
                    // }).catch(err => {
                    //     reject(err);
                    // })
                }
                if (categories && categories.categories) {
                    if (categories.categories.data) {
                        let RequiredPropertiesArray = (categories.categories.data.required_properties) ? categories.categories.data.required_properties : [];
                        if (RequiredPropertiesArray && RequiredPropertiesArray.length > 0) {
                            if (RequiredPropertiesArray.includes(propertyName) == true) {
                                if ((categoryb_enabled == true || categoryb_enabled == 'true')) {
                                    insertQueryListCatB.push({
                                        device_code: deviceCode,
                                        model: model,
                                        parsed_at: parsedAt,
                                        event_at: eventAt,
                                        property_name: propertyName,
                                        value,
                                        property_endpoint,
                                        property_display_name,
                                        company_id: companyId,
                                    })
                                    // const deviceHistory = await categoryb_models.device_events.create({
                                    //     device_code: deviceCode,
                                    //     model: model,
                                    //     parsed_at: parsedAt,
                                    //     event_at: eventAt,
                                    //     property_name: propertyName,
                                    //     value,
                                    //     property_endpoint,
                                    //     property_display_name,
                                    //     company_id: companyId,
                                    // }).catch(err => {
                                    //     console.log("🚀 ~ returnnewPromise ~ err:", err)
                                    //     reject(err);
                                    // })
                                }
                            }
                        }
                    }
                }

                }

                if (typeof Propertyvalue != 'string') {
                    Propertyvalue = JSON.stringify(Propertyvalue)
                }
                let data = {
                    "device_code": deviceCode,
                    "property_name": propertyName,
                    "property_value": Propertyvalue,
                    "type": "condition",
                    "company_id": companyId
                }
                let where = {
                    device_code: deviceCode,
                    property_name: propertyName,
                    property_value: Propertyvalue,
                    config_type: "condition"
                }
                const oneTouchCbCommunicationConfig = await models.one_touch_cb_communication_configs.findOne({
                    where
                }).then((result) => result)
                    .catch((e) => {
                        reject(e)
                    });
                if (oneTouchCbCommunicationConfig) {
                    cloudBridgeQueueProducer.sendProducer(data);
                }
            }
        }
        if(insertQueryList.length>0){
             //console.log("🚀 ~ returnnewPromise ~ insertQueryList:", insertQueryList)
             const deviceHistory = await models.device_events.bulkCreate(insertQueryList).catch(err => {
                        reject(err);
                    })
        }
        if(insertQueryListCatB.length>0){
             //console.log("🚀 ~ returnnewPromise ~ insertQueryListCatB:", insertQueryListCatB)
             const deviceHistory = await categoryb_models.device_events.bulkCreate(insertQueryListCatB).catch(err => {
                                        reject(err);
                                    })
        }
        resolve()

    })
}
var publishSyncBlockProperty = function (company_id, gateway_code, value) {
    return new Promise(async (resolve, reject) => {
        // var params = {
        //     thingName: gateway_code,
        // };
        // console.log("🚀 ~ returnnewPromise ~ params: publishSyncBlockProperty 148", params)
        // const shadowData = await CommunicateWithAwsIotService.communicateWithAwsIot(params, company_id, 'getThingShadow')
        //     .then((data) => {
        //         return (data);
        //     }).catch(err => {
        //         reject(err);
        //     });
        // if (shadowData) {
        const property = `premium_app:sync_block`;
        var payload = {
            state:
            {
                reported: {},
            },
        };
        payload.state.reported[property] = JSON.stringify(value);
        const topic = `$aws/things/${gateway_code}/shadow/update`;
        var params = {
            topic,
            payload: JSON.stringify(payload),
        };
        // console.log("🚀 ~ returnnewPromise ~ params: publishSyncBlockProperty 168", params)
        const publishShadowData = await CommunicateWithAwsIotService.communicateWithAwsIot(params, company_id, 'publish')
            .then((data) => {
                return (data);
            }).catch(err => {
                reject(err);
            });
        return { success: true };
        // }
    })
};
function enableRuleGroup(key, device_code, company_id) {
    return new Promise(async (resolve, reject) => {
        //  publish setTriggerRule logic
        // find the ruleGroups
        const ruleGroups = await models.rule_groups.findOne({
            where: {
                key,
            }
        }).then(result => { return (result) }).catch(err => {
            reject(err)
        });
        // if rule groups are there then only go ahead
        if (ruleGroups) {
            const gatewayid = ruleGroups.gateway_id;
            // make rule groups rules array
            const ruleGroupsArrayKeys = lodash.map(ruleGroups.rules, 'key');
            /// get the one touch rules of all the one touch connected to this gateway_id
            const gatewayOneTouchArray = await models.one_touch_rules.findAll({
                where: {
                    gateway_id: gatewayid,
                    key: {
                        [Op.in]: ruleGroupsArrayKeys
                    }
                },
            }).then((result) => { return (result) }).catch(err => {
                reject(err);
            });
            const setTriggerRule = ':sRule:SetTriggerRule';
            if (gatewayOneTouchArray && gatewayOneTouchArray.length > 0) {
                for (const element of gatewayOneTouchArray) {
                    // const element = gatewayOneTouchArray[element];
                    const ruleTriggerKey = element.rule_trigger_key;
                    // console.log("🚀 ~ returnnewPromise ~ ruleTriggerKey: enableRuleGroup 1293", ruleTriggerKey)
                    await CommunicateWithAwsIotService.publishDeviceName(company_id, device_code, setTriggerRule, ruleTriggerKey);
                    await sleep(1000);
                }
            }
            resolve();
        }
    });
}

function manageDeviceUpdateAccepted(obj) {
    console.log("RABBITMQ manageDeviceUpdateAccepted start")
    return new Promise(async (resolve, reject) => {
        var alertMessageKey = Object.keys(obj).filter((name) => name.endsWith("AlertMessage"));
        var actionValueKey = Object.keys(obj).filter((name) => name.endsWith(":ActionValue"));
        var alarmStatusKey = Object.keys(obj).filter((name) => name.endsWith(":Protect:AlarmStatus"));
        var cloudConditionKey = Object.keys(obj).filter((name) => name.endsWith(":CloudCondition"));
        var syncBlockKey = Object.keys(obj).filter((name) => name.endsWith("premium_app:sync_block"));
        var deviceStatusKey = Object.keys(obj).filter((name) => name.endsWith(":sRule:MyStatus"));
        var deviceRuleTimeStamp = Object.keys(obj).filter((name) => name.endsWith(":sRule:RuleTimeStamp"));
        var deviceScheduleTimeStamp = Object.keys(obj).filter((name) => name.endsWith(":sGenSche:GenScheTimeStamp"));
        var GenScheURL = Object.keys(obj).filter((name) => name.endsWith(":sGenSche:GenScheURL"));
        var JsonURL = Object.keys(obj).filter((name) => name.endsWith(":sRule:JsonURL"));
        var deviceName = Object.keys(obj).filter((name) => name.endsWith(":DeviceName"));
        var errorBatteryAlarmState_d = Object.keys(obj).filter((name) => name.endsWith(":ErrorBatteryAlarmState_d"));
        var deviceErrorCode_d = Object.keys(obj).filter((name) => name.endsWith(":DeviceErrorCode"));
        let timezone = Object.keys(obj).filter((name) => name.endsWith(":sGateway:TimeZone"));
        let lattitude = obj.cloud_metadata_latitude;
        let longitude = obj.cloud_metadata_longitude;
        var deviceCode = obj.topic_name;
        var model = obj.model;
        console.log("RABBITMQ manageDeviceUpdateAccepted model:"+model)
        const splitArr = deviceCode.split('-');
        const devicesData = {};

        if (splitArr.length > 2) {
            devicesData.mac_address = splitArr[3]
        } else {
            devicesData.mac_address = splitArr[1]
        }
        if (obj.connected === 'online' || obj.connected === 'true') {
            devicesData.status = 'online';
        } else {
            devicesData.status = 'offline';
        }
        const gateway = `${splitArr[0]}-${splitArr[1]}`;
        const company = await getCompany(null, process.env.COMPANY_CODE).then(result => {
            return (result);
        }).catch(err => {
            reject(err);
        });
        const companyId = company.id;
        if (!model) {
            var modelSplit = deviceCode.split('-');
            if (modelSplit.length == 2) {
                model = modelSplit[0]
            } else if (modelSplit.length > 2) {
                model = modelSplit[2]
            }
        }
        if (deviceName && deviceName.length > 0 && splitArr.length > 2) {
            try {
                if (obj[deviceName[0]] && JSON.parse(obj[deviceName[0]]).deviceName) {
                    devicesData.name = JSON.parse(obj[deviceName[0]]).deviceName;
                }
            } catch (error) {
                devicesData.name = obj[deviceName[0]]
            }
        }
        devicesData.model = model
        devicesData.device_code = deviceCode
        // if (company.alert_configs && company.alert_configs.event_count_enable && company.alert_configs.event_count_enable == true) {

        //     const cacheKey = 'deviceEventCount';
        //     const deviceEventId = `${moment().startOf('day').format('YYYY-MM-DD')}-${deviceCode}`;
        //     const expiryInSeconds = await getExpiryTimeUntilEndOfCurrentDay();
        //     let data = await getOneFromCache(cacheKey, deviceEventId)
        //     if (data != null) {
        //         let msgCount = await getIncreament(deviceEventId);
        //         // await models.device_events_count.update({
        //         //     count: msgCount
        //         // }, {
        //         //     where: {
        //         //         device_code: deviceCode,
        //         //         day: moment().startOf('day').format('YYYY-MM-DD')
        //         //     }
        //         // }).catch(err => {
        //         //     console.log("🚀 ~ returnnewPromise ~ err:", err)
        //         //     reject(err)
        //         // });
        //         if (msgCount == company.alert_configs.device_alert_count_threshold1) {
        //             var company_code = process.env.COMPANY_CODE;
        //             var params = {};
        //             params["search"] = `${deviceCode} device event count exceeded`;
        //             params["title"] = `${deviceCode} device event count exceeded`;
        //             params["labels"] = [company_code, "Threshold1", "high"];
        //             params["description"] = `${deviceCode} device event count exceeded to ${msgCount}`
        //             await createIssue(params).catch(err => {
        //                 console.log("Error- device event count exceeded CreateIssue Error", err)
        //             })
        //             addActivityLog(Entities.devices.entity_name, Entities.devices.event_name.device_event_count_exceeded, { obj }, `${devicesData.device_code} device event count exceeded to ${msgCount}`, companyId, companyId)
        //         } else if (msgCount == company.alert_configs.device_alert_count_threshold2) {
        //             var company_code = process.env.COMPANY_CODE;
        //             var params = {};
        //             params["search"] = `${deviceCode} device event count exceeded`;
        //             params["title"] = `${deviceCode} device event count exceeded`;
        //             params["labels"] = [company_code, "Threshold1", "high"];
        //             params["description"] = `${deviceCode} device event count exceeded to ${msgCount}, please disable the certificate.`
        //             const issueExists = await getIssue(params).catch(err => {
        //                 console.log("Error- device event count exceeded CreateIssue Error", err)
        //             })
        //             if (issueExists == false) {
        //                 params["labels"] = [company_code, "Threshold1", "Threshold2", "highest"];
        //                 await createIssue(params).catch(err => {
        //                     console.log("Error- device event count exceeded CreateIssue Error", err)
        //                 })
        //             }
        //             addActivityLog(Entities.devices.entity_name, Entities.devices.event_name.device_event_count_exceeded, { obj }, `${devicesData.device_code} device event count exceeded to ${msgCount}`, companyId, companyId)

        //         } else {
        //             resolve();
        //         }
        //     }
        //     if (!data) {
        //         await models.device_events_count.create({
        //             device_code: deviceCode,
        //             count: 1,
        //             day: moment().startOf('day').format('YYYY-MM-DD')
        //         }).catch(err => {
        //             console.log("Error- device event count add Error", err)
        //         })
        //         await setDataWithDateCacheKey(cacheKey, deviceEventId, { deviceCode }, expiryInSeconds);
        //     }
        // }
        await manageAcceptedDeviceHistories(obj).catch(err => {
        })
        if (timezone && timezone.length > 0 && splitArr.length == 2) {
            var value = obj[timezone[0]];
            let timezoneValue = 'UTC';
            if (value) {
                if (!value.includes('=')) {
                    timezoneValue = value;
                } else {
                    timezoneValue = 'UTC';
                }
            }
            let dataobj = {
                "timezone": timezoneValue
            }
            updateDeviceOrGateway(dataobj, gateway, companyId)
                .then(result => {
                    resolve(result)
                }).catch(err => {
                    reject(err)
                })
        }
        if (lattitude && longitude && splitArr.length == 2) {
            var latlong = {
                lat: lattitude,
                lng: longitude
            };
            let dataobj = {
                "latlong": latlong
            }
            updateDeviceOrGateway(dataobj, gateway, companyId)
                .then(result => {
                    resolve(result)
                }).catch(err => {
                    reject(err)
                })
        }

        if (alarmStatusKey && alarmStatusKey.length > 0) {
            var value = obj[alarmStatusKey[0]];

            let parsedAt = new Date(obj["parsedAt"]);
            if(value!=0 || value!="0"){
                let alert_type = "AlarmStatus"
                let device = await models.devices.findOne({
                    where: {
                        device_code: deviceCode,
                    }
                }).then(result => {
                    return (result)
                }).catch(err => {
                    reject(err)
                })
                if(device){
                    const object = {
                        alert_type,
                        device_id:device.id,
                    };
                    await manageEventTimeout(parsedAt, company.alert_configs.event_timeout, object).catch(err => {
                        reject(err);
                    });
                }

            }
        }

        if (GenScheURL && GenScheURL.length > 0) {
            var value = obj[GenScheURL[0]];
            if (value.includes("api/v1/schedules/device_schedules") && !(value.includes("success") || value.includes("multi_same_errors")|| value.includes("working") || value.includes("queueing"))) {
                var splitDeviceCode = value.split('=');
                splitDeviceCode = splitDeviceCode[1].split(' ');
                var id = splitDeviceCode[0]
                const findDeviceReferenceObj = await models.device_references.findOne({
                    where: { id },
                    raw: true,
                })
                if (findDeviceReferenceObj) {
                    var device_id = findDeviceReferenceObj.device_id;
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
                        const type = "schedule";
                        const deviceReferenceObj = await addDeviceReference(device_id, type)
                            .then((result) => {
                                return (result);
                            }).catch(err => {
                                reject(err);
                            });

                        const ref = deviceReferenceObj.id;
                        const host = process.env.SERVICE_HOST || 'dev-service.ctiotsolution.com';
                        const url = `https://${host}/api/v1/schedules/device_schedules?ref=${ref}`;
                        // console.log("🚀 ~ returnnewPromise ~ url manageDeviceUpdateAccepted 1453:", url)
                        await CommunicateWithAwsIotService.publishGenScheURL(companyId, device.device_code, url);

                    }
                }
            }

        }

        if (JsonURL && JsonURL.length > 0) {
            var value = obj[JsonURL[0]];
            if (value.includes("/one_touch/gateway_rules") && (value.includes("download_failed") || value.includes("file_error"))) {
                var splitDeviceCode = value.split('=');
                splitDeviceCode = splitDeviceCode[1].split(' ');
                var id = splitDeviceCode[0]
                const findDeviceReferenceObj = await models.device_references.findOne({
                    where: { id },
                    raw: true,
                })
                if (findDeviceReferenceObj) {
                    var device_id = findDeviceReferenceObj.device_id;
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
                        const type = "one_touch_rule";
                        const deviceReferenceObj = await addDeviceReference(device_id, type)
                            .then((result) => {
                                return (result);
                            }).catch(err => {
                                reject(err);
                            });

                        const ref = deviceReferenceObj.id;
                        const host = process.env.SERVICE_HOST;
                        const url = `https://${host}/api/v1/one_touch/gateway_rules?ref=${ref}`;
                        // console.log("🚀 ~ returnnewPromise ~ url: manageDeviceUpdateAccepted 1495", url)
                        await CommunicateWithAwsIotService.publishJsonUrl(companyId, device.device_code, url);
                    }
                }
            }
        }

        if (deviceRuleTimeStamp && deviceRuleTimeStamp.length > 0) {
            var ruleTimeStamp = obj[deviceRuleTimeStamp[0]]; // ruleTimeStamp
            var deviceCode = obj.topic_name // gatewayCode
            // fing gateway record
            if ((ruleTimeStamp != 0 || ruleTimeStamp != "0") && ruleTimeStamp != null) {
                var deviceRecord = await checkDeviceOrGatewayExists(deviceCode, companyId)
                    .catch(err => {
                        reject(err);
                    });
                if (deviceRecord) {
                    const gateway_id = deviceRecord.id;
                    const gatewayStatus = deviceRecord.status;
                    const company_code = company.code;
                    const file = '/tmp/rule_in/rule.json';
                    if (gatewayStatus == 'online') {
                        const type = "one_touch_rule";
                        // adding device reference record
                        const deviceReferenceObj = await addDeviceReference(gateway_id, type)
                            .then((result) => {
                                return (result);
                            }).catch(err => {
                                reject(err);
                            });
                        const uploadProperty = ':sRule:SetUpdateRuleJsonURL';
                        const token = deviceReferenceObj.id;
                        const host = process.env.SERVICE_HOST;
                        const api = `https://${host}/api/v1/devices/one_touch_rules?token=${token}&company_code=${company_code}`;
                        const url = `curl --location -k --request POST '${api}' --header 'Accept: /' --form 'file=@${file}'`;
                        // working below code
                        // console.log("🚀 ~ returnnewPromise ~ url manageDeviceUpdateAccepted 1531:", url)
                        await CommunicateWithAwsIotService.publishDeviceName(companyId, deviceCode, uploadProperty, url);
                        // send data to producer
                        const data = {
                            ruleTimeStamp,
                            type: type,
                            // extra
                            devide_id: gateway_id, deviceCode, deviceStatus: gatewayStatus, company_code, company_id: companyId
                        }
                        // env variable
                        sqsFileUploadProducer.sendProducer(data, 300);
                    } else {
                    }
                } else {
                }
            } else {
            }
        }

        if (deviceScheduleTimeStamp && deviceScheduleTimeStamp.length > 0) {
            var scheduleTimeStamp = obj[deviceScheduleTimeStamp[0]]; // scheduleTimeStamp
            var deviceCode = obj.topic_name // gatewayCode
            // find gateway record
            if ((scheduleTimeStamp != 0 || scheduleTimeStamp != "0") && scheduleTimeStamp != null) {
                var deviceRecord = await checkDeviceOrGatewayExists(deviceCode, companyId)
                    .catch(err => {
                        reject(err);
                    });
                if (deviceRecord) {
                    const device_id = deviceRecord.id;
                    const deviceStatus = deviceRecord.status;
                    const company_code = company.code;
                    var euid = deviceRecord.mac_address;
                    euid = euid.replace(/[:]/g, '');
                    euid = euid.toLowerCase();
                    const file = `/tmp/schedule/run/sch_${euid}.json`;
                    if (deviceStatus == 'online') {
                        const type = "schedule";
                        // adding device reference record
                        const deviceReferenceObj = await addDeviceReference(device_id, type)
                            .then((result) => {
                                return (result);
                            }).catch(err => {
                                reject(err);
                            });
                        const uploadProperty = ':sGenSche:SetUpdateGenScheURL';
                        const token = deviceReferenceObj.id;
                        const host = process.env.SERVICE_HOST;
                        const api = `https://${host}/api/v1/devices/schedules?token=${token}&company_code=${company_code}`;
                        const url = `curl --location -k --request POST '${api}' --header 'Accept: /' --form 'file=@${file}'`;
                        // working below code
                        // console.log("🚀 ~ returnnewPromise ~ url: manageDeviceUpdateAccepted 1582", url)
                        await CommunicateWithAwsIotService.publishDeviceName(companyId, deviceCode, uploadProperty, url);
                        // send data to producer
                        const data = {
                            scheduleTimeStamp,
                            type: type,
                            euid,
                            // extra
                            device_id, deviceCode, deviceStatus, company_code, company_id: companyId
                        }
                        // env variable
                        sqsFileUploadProducer.sendProducer(data, 300);
                    } else {
                    }
                } else {
                }
            } else {
            }
        }

        if (errorBatteryAlarmState_d && errorBatteryAlarmState_d.length > 0) {
            let errorBatteryAlarmStatedValue = obj[errorBatteryAlarmState_d[0]];
            if (process.env.COMPANY_CODE === 'purmo') {
                var manageLowBatteryAlerts = await managePurmoLowBatteryAlert(errorBatteryAlarmState_d[0], errorBatteryAlarmStatedValue, deviceCode, companyId, model)
                    .catch((err) => {
                        reject(err)
                    })
            }
            // else{
            //     await manageLowBatteryAlert(errorBatteryAlarmState_d[0], errorBatteryAlarmStatedValue, deviceCode, companyId, model)
            //     .catch((err) => {
            //         reject(err)
            //     })
            // }
        }
        if (deviceErrorCode_d && deviceErrorCode_d.length > 0) {
            let errorDeviceErrorCodeValue = obj[deviceErrorCode_d[0]];
            var manageLowBatteryAlerts = await managePurmoDeviceErrorcode(deviceErrorCode_d[0], errorDeviceErrorCodeValue, deviceCode, companyId, model)
                .catch((err) => { reject(err) })
        }

        var manageDeviceAlertsresp = await manageDeviceAlerts(obj, deviceCode, companyId, model)
            .catch((err) => { })

        if (alertMessageKey && alertMessageKey.length > 0) {
            var value = obj[alertMessageKey[0]];
            var deviceCode = obj.topic_name
            const object = {
                value: value,
                deviceCode
            }
            await oneTouchCommunicationConfig(object).then(result => { result })
                .catch(err => {
                    reject(err);
                })
            // resolve()
        } else if (deviceStatusKey && deviceStatusKey.length > 0) {
            var ruleGroupKey = obj[deviceStatusKey[0]]; // ruleGroup_key
            var deviceCode = obj.topic_name // gatewayCode
            var splitDeviceCode = deviceCode.split('-');
            if (deviceCode && splitDeviceCode.length == 2 && splitDeviceCode[0].endsWith('GW')) {
                // call to enableRuleGroup function
                // await enableRuleGroup(ruleGroupKey, deviceCode, companyId)
                //     .then(result => { result })
                //     .catch(err => {
                //         reject(err);
                //     })
            }
            // resolve()
        }

        if (cloudConditionKey && cloudConditionKey.length > 0) {
            if (obj[cloudConditionKey[0]] != "i0d") {
                let value = "i0d";
                let setCloudCondition = ":sRule:SetCloudCondition"
                // console.log("🚀 ~ returnnewPromise ~ setCloudCondition manageDeviceUpdateAccepted: 1641", setCloudCondition)
                await CommunicateWithAwsIotService.publishDeviceName(companyId, gateway, setCloudCondition, value);
            }
        }

        if (syncBlockKey && syncBlockKey.length > 0) {
            // if ( != "i0d") {
            let value = obj[syncBlockKey[0]];
            const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
            let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": false, "eventTime": formattedDateTime } }
            if (value) {
                valueObj = JSON.parse(value)
            }
            if ((valueObj.hasOwnProperty("deviceListChanged") && valueObj.deviceListChanged["event"] === true) || (valueObj.hasOwnProperty("alertListChanged") && valueObj.alertListChanged["event"] === true)) {
                publishSyncBlockProperty(companyId, gateway, defaultValue)
            }

        }

        if (actionValueKey && actionValueKey.length > 0) {
            let value = obj[actionValueKey[0]];
            let data = {
                "gateway_code": gateway,
                "array": value,
                "type": "action",
                "company_id": companyId
            }
            let setReportLastActionValue = ":sRule:SetReportLastActionValue"
            // console.log("🚀 ~ returnnewPromise ~ setReportLastActionValue: 1654", setReportLastActionValue)
            await CommunicateWithAwsIotService.publishDeviceName(companyId, gateway, setReportLastActionValue, value);
            let where = {
                gateway_code: gateway,
                config_type: 'action',
            }
            const oneTouchCbCommunicationConfig = await models.one_touch_cb_communication_configs.findAll({
                where
            }).then((result) => result)
                .catch((e) => {
                    reject(e)
                });
            if (oneTouchCbCommunicationConfig && oneTouchCbCommunicationConfig.length > 0) {
                cloudBridgeQueueProducer.sendProducer(data);
            }
        }
        //This below code is to create the device if it is not present in devices table
        if (splitArr.length > 2) {

            var gatewayObj = await checkDeviceOrGatewayExists(gateway, companyId).catch(error => {
                reject(error)
            })
            if (gatewayObj) {
                checkDeviceOrGatewayExists(deviceCode, companyId).then(async (result) => {
                    //if not exists then create
                    if (!result) {
                        var dataobj = {
                            data: devicesData,
                            gateway: gatewayObj.id
                        }
                        await manage(dataobj, 0, null).then((result) => {
                            resolve()
                        }).catch(error => {
                            reject(error)
                        })
                    } else {
                        if ((deviceName && deviceName.length > 0) || (result.status != devicesData.status)) {
                            var dataobj = {
                                data: devicesData,
                                gateway: gatewayObj.id
                            }
                            await manage(dataobj, 0, null).then((result) => {
                                resolve()
                            }).catch(error => {
                                reject(error)
                            })
                            //update device name
                        } else {
                            //if exists then don't do anything
                            resolve()
                        }
                    }
                }).catch(error => {
                    reject(error)
                })
            } else {
                resolve()
            }

        } else {
            resolve()
        }

    })
}
var convertDecimalToBinary = function (numberToConvert, numberOfBits) {
    const arrBitwise = [0];
    for (let i = 0; i < numberOfBits; i++) {
        let mask = 1;

        const bit = numberToConvert & (mask << i); // And bitwise with left shift

        if (bit === 0) {
            arrBitwise[i] = 0;
        } else {
            arrBitwise[i] = 1;
        }
    }
    return arrBitwise
}
function manageDeviceUpdate(obj, pointer) {
    return new Promise(async (resolve, reject) => {
        try {
            if (obj.current) {
                let object = obj
                let data = obj.current
                const deviceCode = obj.topic_name
                if (!companyId) {
                    const company = await getCompany(null, process.env.COMPANY_CODE).then(result => {
                        return (result);
                    }).catch(err => {
                        reject(err);
                    });
                    companyId = company.id;
                }
                // var job = await createJob("addDeviceJob", "Started", {
                //     deviceCode: deviceCode
                // }, companyId).catch(err => {
                //     reject(err)
                // })
                var jobId = null
                // await addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, { deviceCode }, "Adding device event history.", jobId, companyId)
                // await manageDeviceHistories(object).catch(err => {
                //     // updateJob("Failed", jobId)
                //     reject(err);
                // });
                // await addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, { deviceCode }, "Successfully added device event history.", jobId, companyId)
                // await addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, { deviceCode }, "Started getting required data from obj.", jobId, companyId)
                const devicesData = {};
                let deviceName = null;
                let model = null;
                let dsn = null;
                let mac = null;
                let firmwareVersion = null;
                let shortId = null;
                let deviceStatus = null;
                devicesData.datapoints = {}
                let timezone = null;
                // let time_format = null;
                const splitArr = deviceCode.split('-');
                model = Object.keys(data).filter((name) => /model/.test(name));
                dsn = Object.keys(data).filter((name) => /DSN/.test(name));
                mac = Object.keys(data).filter((name) => /EUID/.test(name));

                if (!mac || mac.length < 1) {
                    //When (WiFiConnected_d=1 and LanConnected_d=0), gateway connects in WiFi mode, App is using NetworkWiFiMAC for MAC address;
                    var lanConnected = Object.keys(data).filter((name) => /LANConnected/.test(name))
                    var wifiConnected = Object.keys(data).filter((name) => /WiFiConnected/.test(name))
                    var lanMac = Object.keys(data).filter((name) => /NetworkLANMAC/.test(name))
                    var wifiMac = Object.keys(data).filter((name) => /NetworkWiFiMAC/.test(name))
                    if (data[wifiConnected] == 1 && data[lanConnected] == 0) {
                        mac = wifiMac
                    } else {
                        mac = lanMac
                    }
                }
                var leaveNetwork = Object.keys(data).filter((name) => name.endsWith(":LeaveNetwork"));
                var leaveRequest = Object.keys(data).filter((name) => name.endsWith(":LeaveRequest_d"));
                firmwareVersion = Object.keys(data).filter((name) => name.endsWith(":FirmwareVersion"));
                shortId = Object.keys(data).filter((name) => name.endsWith(":ShortID_d"));
                deviceStatus = Object.keys(data).filter((name) => name.endsWith(":sRule:MyStatus"));
                // time_format = Object.keys(data).filter((name) => name.endsWith(":sCoord:TimeFormat24Hour"));
                timezone = Object.keys(data).filter((name) => name.endsWith(":sGateway:TimeZone"));
                if (!firmwareVersion || firmwareVersion.length < 1) {
                    firmwareVersion = Object.keys(data).filter((name) => /GatewaySoftwareVersion/.test(name))
                }

                deviceName = Object.keys(data).filter((name) => name.endsWith(":DeviceName"));
                if (!deviceName) {
                    if (splitArr.length > 2) {
                        deviceName = `[ ${splitArr[3]} ]`;
                    }
                }
                try {
                    if (data[deviceName] && JSON.parse(data[deviceName]).deviceName) {
                        devicesData.name = JSON.parse(data[deviceName]).deviceName;
                    }
                } catch (error) {
                    devicesData.name = data[deviceName]
                }
                devicesData.timezone = data[timezone] || null;
                // devicesData.time_format = data[time_format] || null;
                devicesData.short_id = data[shortId] || null;
                devicesData.model = data[model] || null;
                devicesData.serial_number = data[dsn] || null;
                devicesData.mac_address = data[mac] || null;

                if (!devicesData.mac_address) {
                    if (splitArr.length > 2) {
                        devicesData.mac_address = splitArr[3]
                    } else {
                        devicesData.mac_address = splitArr[1]
                    }
                }
                if (!devicesData.model) {
                    var modelSplit = deviceCode.split('-');
                    model = ['model']
                    if (modelSplit.length == 2) {
                        devicesData.model = modelSplit[0]
                    } else if (modelSplit.length > 2) {
                        devicesData.model = modelSplit[2]
                    }
                }
                // if (data[time_format]) {
                //     if (data[time_format] == 1) {
                //         devicesData.time_format = true;
                //     } else {
                //         devicesData.time_format = false;
                //     }
                // }
                if (data[timezone]) {
                    if (!data[timezone].includes('=')) {
                        devicesData.timezone = data[timezone];
                    } else {
                        devicesData.timezone = 'UTC';
                    }
                }

                if (devicesData.mac_address) {
                    devicesData.mac_address = devicesData.mac_address.toUpperCase()
                }
                devicesData.firmware_verison = data[firmwareVersion] || null;
                if (data.connected === 'online' || data.connected === 'true') {
                    devicesData.status = 'online';
                } else {
                    devicesData.status = 'offline';
                }
                devicesData.device_code = deviceCode;
                const gateway = `${splitArr[0]}-${splitArr[1]}`;

                let key = 'constants'
                let constants = await Constant(key)

                const indexOf = (arr, q) => arr.findIndex(item => q.toLowerCase() === item.toLowerCase());
                const temperatureAddModelList = [...constants.Models.thermostat, ...constants.Models.temperatureSensor, 'SC102ZB', ...constants.Models.wirelessFanCoilRemotes]
                const setpointAddModelList = [...constants.Models.thermostat, 'SC102ZB']
                const onOffAddList = [...constants.Models.smartPlug, ...constants.Models.smartRelay, ...constants.Models.waterShutOffValves, ...constants.Models.zigbeeDimmer, 'SX903ZB']
                const runningModeModelList = ['it600HW-AC', 'it600HW_AC', 'it600HW', 'NTVS41HW', 'TS600HW']
                const lockedAddModelList = [...constants.Models.thermostat, 'SC102ZB', 'ST103ZB']

                const TempMeasuredValue = Object.keys(data).filter((name) => name.endsWith(":sTempS:MeasuredValue_x100"))
                const localTemperature = Object.keys(data).filter((name) => name.endsWith(":LocalTemperature_x100"))
                const displayMode = Object.keys(data).filter((name) => name.endsWith(":TemperatureDisplayMode"))
                const systemMode = Object.keys(data).filter((name) => name.endsWith(":SystemMode"))
                const holdType = Object.keys(data).filter((name) => name.endsWith(":HoldType"))
                const runningState = Object.keys(data).filter((name) => name.endsWith(":RunningState"))
                const runningMode = Object.keys(data).filter((name) => name.endsWith(":RunningMode"))
                const onOff = Object.keys(data).filter((name) => name.endsWith(":sOnOffS:OnOff"))
                const doorWindowOpenClose = Object.keys(data).filter((name) => name.endsWith(':ErrorIASZSAlarmed1'))
                const locked = Object.keys(data).filter((name) => name.endsWith(':LockKey'))

                //for temperature sensor use property sTempS:MeasuredValue_x100
                if (TempMeasuredValue && TempMeasuredValue.length > 0 && indexOf(temperatureAddModelList, data[model]) !== -1) {
                    devicesData.datapoints["tempareture"] = (Math.round((data[TempMeasuredValue] / 100) * 2) / 2) + " °C"
                }

                //Bellow if condition is to add the temperature in datqapoints for all thermostats, SC102ZB and Temperature Sensors.
                if (localTemperature && localTemperature.length > 0 && indexOf(temperatureAddModelList, data[model]) !== -1) {
                    if ((data[localTemperature]) <= -32700) {
                        devicesData.datapoints["tempareture"] = '- -'
                    } else {
                        if (data[displayMode] == 1) {
                            if (devicesData.model == 'ST880ZB') {
                                devicesData.datapoints["tempareture"] = Math.floor(((data[localTemperature] / 100) * 9 / 5) + 32) + " °F"
                            } else {
                                devicesData.datapoints["tempareture"] = Math.round(((data[localTemperature] / 100) * 9 / 5) + 32) + " °F"
                            }
                        } else {
                            devicesData.datapoints["tempareture"] = (Math.round((data[localTemperature] / 100) * 2) / 2) + " °C"
                        }
                    }
                }
                //Bellow if condition is to add the setpoint in datqapoints for all thermostats, SC102ZB .
                if (systemMode && holdType && systemMode.length > 0 && holdType.length > 0 && indexOf(setpointAddModelList, data[model]) !== -1) {
                    var coolingSetpoint = Object.keys(data).filter((name) => name.endsWith(":CoolingSetpoint_x100"))
                    var heatingSetpoint = Object.keys(data).filter((name) => name.endsWith(":HeatingSetpoint_x100"))

                    if ((data[systemMode] == 3 && data[holdType] != 7)) { // cooling
                        if (data[displayMode] == 1) {
                            if (devicesData.model == 'ST880ZB') {
                                devicesData.datapoints["setPoint"] = "Cool " + Math.floor(((data[coolingSetpoint] / 100) * 9 / 5) + 32) + " °F"
                            } else {
                                devicesData.datapoints["setPoint"] = "Cool " + Math.round(((data[coolingSetpoint] / 100) * 9 / 5) + 32) + " °F"

                            }
                        } else {
                            devicesData.datapoints["setPoint"] = "cool " + (Math.round((data[coolingSetpoint] / 100) * 2) / 2) + " °C"
                        }
                    }
                    if ((data[systemMode] == 4 && data[holdType] != 7)) { // heating
                        if (data[displayMode] == 1) {
                            if (devicesData.model == 'ST880ZB') {
                                devicesData.datapoints["setPoint"] = "Heat " + Math.floor(((data[heatingSetpoint] / 100) * 9 / 5) + 32) + " °F"
                            } else {
                                devicesData.datapoints["setPoint"] = "Heat " + Math.round(((data[heatingSetpoint] / 100) * 9 / 5) + 32) + " °F"

                            }
                        } else {
                            devicesData.datapoints["setPoint"] = "Heat " + (Math.round((data[heatingSetpoint] / 100) * 2) / 2) + " °C"
                        }
                    }
                    if (data[systemMode] == 0) { // off
                        // devicesData.datapoints["tempareture"] = (((data[localTemperature] / 100) * 9 / 5) + 32) + " °F"
                    }
                    if ((data[systemMode] == 1 && data[holdType] != 7)) { // auto
                        if (data[displayMode] == 1) {
                            if (devicesData.model == 'ST880ZB') {
                                devicesData.datapoints["setPoint"] = "Heat " + Math.floor(((data[heatingSetpoint] / 100) * 9 / 5) + 32) + " °F , Cool " + Math.round(((data[coolingSetpoint] / 100) * 9 / 5) + 32) + " °F"
                            } else {
                                devicesData.datapoints["setPoint"] = "Heat " + Math.round(((data[heatingSetpoint] / 100) * 9 / 5) + 32) + " °F , Cool " + Math.round(((data[coolingSetpoint] / 100) * 9 / 5) + 32) + " °F"
                            }
                        } else {
                            devicesData.datapoints["setPoint"] = "Heat " + (Math.round((data[heatingSetpoint] / 100) * 2) / 2) + " °C , Cool " + (Math.round((data[coolingSetpoint] / 100) * 2) / 2) + " °C"
                        }
                    }
                    if ((data[systemMode] == 5 && data[holdType] != 7)) { // heating
                        if (data[displayMode] == 1) {
                            if (devicesData.model == 'ST880ZB') {
                                devicesData.datapoints["setPoint"] = "Emergency Heating " + Math.floor(((data[heatingSetpoint] / 100) * 9 / 5) + 32) + " °F"
                            } else {
                                devicesData.datapoints["setPoint"] = "Emergency Heating " + Math.round(((data[heatingSetpoint] / 100) * 9 / 5) + 32) + " °F"
                            }
                        } else {
                            devicesData.datapoints["setPoint"] = "Emergency Heating " + (Math.round((data[heatingSetpoint] / 100) * 2) / 2) + " °C"
                        }
                    }
                }
                //Bellow if condition is to add the status in datqapoints for all thermostats, SC102ZB. Heating, Cooling or empty from RunningStatus property;.
                if (runningState && runningState.length > 0 && indexOf(setpointAddModelList, data[model]) !== -1) {
                    var bits = convertDecimalToBinary(parseInt(data[runningState]), 8)
                    if (bits[0] == 0 && bits[3] == 0 && bits[7] == 0 && bits[1] == 0 && bits[4] == 0) {
                        devicesData.datapoints["status"] = ""
                    }
                    else if (bits[0] == 1 || bits[3] == 1 || bits[7] == 1) {
                        devicesData.datapoints["status"] = "Heating"
                    }
                    else if (bits[1] == 1 || bits[4] == 1) {
                        devicesData.datapoints["status"] = "Cooling"
                    }
                }
                //Bellow if condition is to add the status in datqapoints for all Smart Plugs, SR600, DI600, SC900ZB, SX903ZB, SC904ZB, SC906ZB, SC812ZB and SC824ZB: On or Off from OnOff property.
                if (onOff && onOff.length > 0 && indexOf(onOffAddList, data[model]) !== -1) {
                    if (data[onOff] == 0) {
                        devicesData.datapoints["status"] = "Off"
                    }
                    else if (data[onOff] == 1) {
                        devicesData.datapoints["status"] = "On"
                    }
                }
                //Bellow if condition is to add the status in datqapoints for  thermostats, it600HW-AC/it600HW_AC, it600HW, NTVS41HW, TS600HW : On or Off from RunningMode property;.
                if (runningMode && runningMode.length > 0 && indexOf(runningModeModelList, data[model]) !== -1) {

                    if (data[runningMode] == 0) {
                        devicesData.datapoints["status"] = "Off"
                    }
                    else if (data[runningMode] == 1) {
                        devicesData.datapoints["status"] = "On"
                    }
                }
                //***IT600Receiver: On or Off from RelayStatus property; not implemented yet

                //Bellow if condition is to add the status in datqapoints for Door/Window sensors: Open or Close form ErrorIASZSAlarmed1.
                if (doorWindowOpenClose && doorWindowOpenClose.length > 0) {
                    if (data[doorWindowOpenClose] == 0) {
                        devicesData.datapoints["status"] = "Close"
                    }
                    else if (data[doorWindowOpenClose] == 1) {
                        devicesData.datapoints["status"] = "Open"
                    }
                }
                //Bellow if condition is to add the locked status in datqapoints for all thermostats, SC102ZB and ST103ZB.
                if (locked && locked.length > 0 && indexOf(lockedAddModelList, data[model]) !== -1) {
                    if (data[locked] == 0) {
                        devicesData.datapoints["locked"] = "No"
                    }
                    else if (data[locked] == 1) {
                        devicesData.datapoints["locked"] = "Yes"
                    }
                }

                if (data[deviceStatus]) {
                    const key_value = data[deviceStatus];
                    const checkRule = await models.rule_groups.findOne({
                        where: {
                            key: key_value,
                        }
                    }).catch((err) => {
                        Logger.info("Error", { "message": "RuleGroup Key Not Found", "data": key_value });
                    });
                    if (checkRule) {
                        const ruleGroupId = checkRule.id;
                        devicesData.rule_group_id = ruleGroupId;
                    }
                }

                // await addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, { deviceCode }, "Checking device is left network or not.", jobId, companyId)
                // For battery powered device ,when device gets factory resert LeaveRequest_d property will get updated.
                if ((leaveNetwork && data[leaveNetwork] == 1) || ( leaveRequest && data[leaveRequest] == 1)) {

                    // await addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, { deviceCode }, "Device is left network. Not able to update or add.", jobId, companyId)
                    // updateJob("Finished", jobId)
                    await models.devices.findOne({
                        where: {
                            device_code: deviceCode,
                        }
                    }).then(async (result) => {
                        if (result && result.status === 'online') {
                            let value = { status: 'offline' };
                            await models.devices.update(value,
                                {
                                    where: {
                                        device_code: deviceCode,
                                    }
                                }).catch(error => {
                                    reject(error)
                                })
                        }
                    })
                    resolve({ obj, pointer })
                } else if (devicesData.mac_address) {
                    if (splitArr.length === 2) {
                        const gatewayModels = process.env.GATEWAY_MODEL_LIST;
                        if (devicesData.model.toUpperCase().endsWith('GW') || (gatewayModels && gatewayModels.includes(devicesData.model.toUpperCase()))) {
                            devicesData.type = 'gateway';
                        }
                        var dataobj = {
                            data: devicesData,
                            gateway: gateway
                        }
                        if (devicesData.status == 'online' && devicesData.status =='online') {
                            models.devices.findOne({
                                where: {
                                    device_code: deviceCode,
                                }
                            }).then(async (result) => {
                                if (result) {
                                    let device_id = result.id
                                    let deviceAlerts = await getDeviceAlerts(device_id).catch(err => {
                                        reject(err)
                                    })
                                    let alertCodeList = lodash.map(deviceAlerts, (element => { return element.alert_type }))
                                    // const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
                                    // const splitArr = deviceCode.split('-');
                                    // const gateway = `${splitArr[0]}-${splitArr[1]}`;
                                    // let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": true, "eventTime": formattedDateTime } }
                                    if (alertCodeList.includes('connected')) {
                                        await removeDeviceAlert('connected', 'connected', device_id, result.company_id).then(result => { result })
                                            .catch(err => {
                                                reject(err);
                                            })
                                        // publishSyncBlockProperty(result.company_id, gateway, defaultValue).catch(err => { })
                                    }
                                }
                            })
                        }
                        if (devicesData.type != 'gateway' ) {
                            dataobj = {
                                data: devicesData,
                                gateway: null
                            }
                        }
                        // await addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, dataobj, "Device type is gateway", jobId, companyId)
                        // Logger.info("DeviceData", dataobj)
                        await manage(dataobj, pointer, jobId).then(result => {
                            // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, dataobj, "Gateway added/updated  successfully", jobId, companyId)
                            // manageDeviceAlerts(obj, deviceCode, companyId, devicesData.model).catch((err) => { })
                            resolve({ obj, pointer })
                        }).catch(error => {
                            reject(error)
                        })
                    } else if (splitArr.length > 2) {
                        var dataobj = {
                            data: devicesData,
                            gateway: gateway
                        }
                        if (devicesData.status == 'online' && devicesData.status =='online') {
                            models.devices.findOne({
                                where: {
                                    device_code: deviceCode,
                                }
                            }).then(async (result) => {
                                if (result) {
                                    let device_id = result.id
                                    let deviceAlerts = await getDeviceAlerts(device_id).catch(err => {
                                        reject(err)
                                    })
                                    let alertCodeList = lodash.map(deviceAlerts, (element => { return element.alert_type }))
                                    // const formattedDateTime = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
                                    // const splitArr = deviceCode.split('-');
                                    // const gateway = `${splitArr[0]}-${splitArr[1]}`;
                                    // let defaultValue = { "deviceListChanged": { "event": false, "eventTime": formattedDateTime }, "alertListChanged": { "event": true, "eventTime": formattedDateTime } }
                                    if (alertCodeList.includes('connected')) {
                                        await removeDeviceAlert('connected', 'connected', device_id, result.company_id).then(result => { result })
                                            .catch(err => {
                                                reject(err);
                                            })
                                        // publishSyncBlockProperty(result.company_id, gateway, defaultValue).catch(err => { })
                                    }
                                }
                            })
                        }
                        // Logger.info("DeviceData", dataobj)
                        // await addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, dataobj, "Device type is device", jobId, companyId)
                        await manage(dataobj, pointer, jobId).then(result => {
                            // addActivityLog(Entities.addDevice.entity_name, Entities.deleteDevice.event_name.job, dataobj, "Device added/updated successfully", jobId, companyId)
                            // manageDeviceAlerts(obj, deviceCode, companyId, devicesData.model).catch((err) => { })
                            resolve({ obj, pointer })
                        }).catch(error => {
                            reject(error)
                        })
                    }
                }
                else {
                    resolve({ obj, pointer })
                }

            }
        } catch (error) {
            // Logger.error("Error", { "error": "Catched error" }, obj)
            reject(error)
        }
    })
}

module.exports = {
    manage, manageDeviceUpdate, manageDeviceHistories, manageDeviceUpdateAccepted, ReUploadJsonUrl,
}
