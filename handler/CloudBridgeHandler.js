const models = require('../models');
const CommunicateWithAwsIotService = require('../services/CommunicateWithAwsIotService');
var { sendProducer } = require('../sqs/CameraDeviceActionQueueProducer');
const Logger = require('../Logger');


const moment = require('moment');

function isValidInteger(s) {
    const num = Number(s);
    return Number.isInteger(num);
}

function manageAction(obj) {
    // console.log("🚀 ~ file: CloudBridgeHandler.js:58 ~ manageAction ~ obj:", JSON.stringify(obj))
    return new Promise(async (resolve, reject) => {
        let gateway_code = obj.gateway_code;
        let camera_id = obj.camera_id;
        let device_code = obj.device_code;
        let company_id = obj.company_id
        let array = JSON.parse(obj.array);
        //  console.log("🚀 ~ file: CloudBridgeHandler.js:16 ~ array:", array)
        let where = null;
        let gateway = null;
        let camera = null;
        if (gateway_code) {
            gateway = await models.devices.findOne({
                where: {
                    device_code: gateway_code
                }
            }).then((result) => result)
                .catch((e) => {
                    reject(e)
                });
            if (!gateway) {
                Logger.info("Info-Error", { "message": "gateway not found", value: gateway_code })
                resolve()
            }
        }
        if (camera_id) {
            camera = await models.camera_devices.findOne({

                where: {

                    camera_id,
                }
            })
            if (!camera) {
                Logger.info("Info-Error", { "message": "camera not found", value: camera_id })
                resolve()
            }
        }
        const positionArray = array.map((value, index) => (value === 1 ? JSON.stringify(index + 1) : null)).filter(index => index !== null);
        // console.log("🚀 ~ file: CloudBridgeHandler.js:49 ~ positionArray:", positionArray)
        if (positionArray && positionArray.length > 0) {
            positionArray.map(async (value, index) => {
                let array_id = value;
                //  console.log("🚀 ~ file: CloudBridgeHandler.js:53 ~ array_id:", array_id)
                if (gateway_code) {
                    where = {
                        gateway_code,
                        config_type: 'action',
                        array_id,
                    }
                }
                else if (gateway_code && device_code) {
                    where = {
                        gateway_code,
                        device_code,
                        array_id,
                        config_type: 'action',
                    }
                } else if (camera_id) {
                    where = {
                        camera_id,
                        array_id,
                        config_type: 'action',
                    }
                }
                const oneTouchCbCommunicationConfig = await models.one_touch_cb_communication_configs.findOne({
                    include: [
                        {
                            model: models.occupants,
                            as: 'occupant'
                        }
                    ],
                    where
                }).then((result) => result)
                    .catch((e) => {
                        // console.log("🚀 ~ file: CloudBridgeHandler.js:101 ~ positionArray.map ~ e:", e)
                        reject(e)
                    });
                // console.log("🚀 ~ file: CloudBridgeHandler.js:89 ~ oneTouchCbCommunicationConfig:", oneTouchCbCommunicationConfig)
                // console.log("🚀 ~ file: CloudBridgeHandler.js:95 ~ positionArray.map ~ oneTouchCbCommunicationConfig:", JSON.stringify(oneTouchCbCommunicationConfig))
                if (oneTouchCbCommunicationConfig && oneTouchCbCommunicationConfig.config_type === 'action') {
                    let occupant_id = oneTouchCbCommunicationConfig.occupant.id;
                    if (gateway) {
                        let isHavePermission = await models.occupants_permissions.findOne({
                            where: {
                                receiver_occupant_id: oneTouchCbCommunicationConfig.occupant.id,
                                gateway_id: gateway.id,
                            },
                        });
                        // console.log("🚀 ~ file: CloudBridgeHandler.js:144 ~ positionArray.map ~ isHavePermission:", isHavePermission)
                        if (!isHavePermission) {
                            Logger.info("Info-Error", { "message": "Permission denied", value: { gateway_code, occupant_id } })
                            resolve()
                        } else {
                            if (oneTouchCbCommunicationConfig.camera_id != null) {
                                var obj = {
                                    occupant_id: oneTouchCbCommunicationConfig.occupant.identity_id,
                                    camera_id: oneTouchCbCommunicationConfig.camera_id,
                                    action: {
                                        type: "one_touch",
                                        name: oneTouchCbCommunicationConfig.property_name,
                                        value: oneTouchCbCommunicationConfig.property_value
                                    },
                                    time: moment(new Date()).utc().format('DD-MM-YYYY hh:mm A'),
                                }
                                // console.log("🚀 ~ file: CloudBridgeHandler.js:111 ~ positionArray.map ~ obj:", JSON.stringify(obj))
                                sendProducer(obj);
                            }
                            else if (oneTouchCbCommunicationConfig.gateway_code != null || oneTouchCbCommunicationConfig.device_code != null) {

                                if (isValidInteger(oneTouchCbCommunicationConfig.property_value)) {

                                    await CommunicateWithAwsIotService.publishPropertyValue(company_id, oneTouchCbCommunicationConfig.device_code, oneTouchCbCommunicationConfig.property_name, Number(oneTouchCbCommunicationConfig.property_value));

                                } else {
                                    await CommunicateWithAwsIotService.publishPropertyValue(company_id, oneTouchCbCommunicationConfig.device_code, oneTouchCbCommunicationConfig.property_name, oneTouchCbCommunicationConfig.property_value);

                                }
                                // console.log("🚀 ~ file: CloudBridgeHandler.js:111 ~ positionArray.map ~ obj:", JSON.stringify(obj))
                                // sendProducer(obj);
                            }
                        }
                    }

                }
            })
        }
        resolve()
    })
}


function manageCondition(obj) {
    return new Promise(async (resolve, reject) => {
        let gateway_code = obj.gateway_code;
        let camera_id = obj.camera_id;
        let device_code = obj.device_code;
        let property_name = obj.property_name;
        let property_value = obj.property_value;
        let company_id = obj.company_id
        let occupant_id = obj.occupant_id;
        let where = null;
        let gateway = null;
        let camera = null;
        if (gateway_code) {
            gateway = await models.devices.findOne({
                where: {
                    device_code: gateway_code
                }
            }).then((result) => result)
                .catch((e) => {
                    reject(e)
                });
            if (!gateway) {
                Logger.info("Info-Error", { "message": "gateway not found", value: gateway_code })
                resolve()
            }
        }
        if (camera_id) {
            camera = await models.camera_devices.findOne({

                where: {

                    camera_id,
                }
            })
            if (!camera) {
                Logger.info("Info-Error", { "message": "camera not found", value: camera_id })
                resolve()
            }
        }
        //will get this while camera events
        //we get camers id ,property_name,property value
        //we need to find its connected gateway, as we dont have 
        if (gateway_code && camera) {

            let camera_permissions = await models.camera_devices.findOne({
                include: [
                    {
                        model: models.occupants_camera_permissions,
                        include: [
                            {
                                model: models.occupants_permissions,
                            }
                        ],
                    },

                ],
                where: {
                    gateway_id: gateway.id,
                    id: camera.id,
                },
                required: true,
            })
            // console.log("🚀 ~ file: CloudBridgeHandler.js:189 ~ returnnewPromise ~ camera_permissions:", camera_permissions)
            if (!camera_permissions) {
                Logger.info("Info-Error", { "message": "Permission denied", value: { gateway_code, camera_id } })
                resolve()
            } else {
                where = {
                    gateway_code,
                    camera_id,
                    property_name,
                    property_value,
                    config_type: "condition"
                }
            }

        } else if (gateway_code && device_code) {
            where = {
                gateway_code,
                device_code,
                property_name,
                property_value,
                config_type: "condition"
            }
        } else if (camera_id) {
            where = {
                camera_id,
                property_name,
                property_value,
                config_type: "condition"
            }
        } else if (occupant_id && gateway) {
            const isHavePermission = await models.occupants_permissions.findOne({
                where: {
                    receiver_occupant_id: occupant_id,
                    gateway_id: gateway.id,
                },
            });
            // console.log("🚀 ~ file: CloudBridgeHandler.js:166 ~ returnnewPromise ~ isHavePermission:", isHavePermission)
            if (!isHavePermission) {
                Logger.info("Info-Error", { "message": "Permission denied", value: occupant_id })
                resolve()
            } else {
                where = {
                    occupant_id,
                    gateway_code,
                    property_name,
                    property_value,
                    config_type: "condition"
                }
            }
            // console.log("🚀 ~ file: CloudBridgeHandler.js:171 ~ returnnewPromise ~ where:", where)
        } else if (device_code) {
            where = {
                device_code,
                property_name,
                property_value,
                config_type: "condition"
            }
        }
        // console.log("🚀 ~ file: CloudBridgeHandler.js:185 ~ returnnewPromise ~ where:", where)
        if (where) {
        // console.log("🚀 ~ file: CloudBridgeHandler.js:247 ~ where:", where)

            // await CommunicateWithAwsIotService.publishPropertyValue(company_id, gateway_code, "ep0:sRule:SetCloudCondition", "i0d");

            const oneTouchCbCommunicationConfig = await models.one_touch_cb_communication_configs.findAll({
                where
            }).then((result) => result)
                .catch((e) => {
                    reject(e)
                });
            // console.log("🚀 ~ file: CloudBridgeHandler.js:200 ~ returnnewPromise ~ oneTouchCbCommunicationConfig:", oneTouchCbCommunicationConfig)
            let array_ids = [];
            if (oneTouchCbCommunicationConfig && oneTouchCbCommunicationConfig.length > 0) {
                // console.log("🚀 ~ file: CloudBridgeHandler.js:205 ~ returnnewPromise ~ oneTouchCbCommunicationConfig:", oneTouchCbCommunicationConfig)
                // oneTouchCbCommunicationConfig.map((data) => {
                //     if (data.config_type == "condition") {
                //         array_id.push(data.array_id)
                //     }
                // })
                array_ids = oneTouchCbCommunicationConfig.map((data) => {
                    if (data.config_type == "condition") {
                        return data.array_id;
                    }
                })
                // console.log("🚀 ~ file: CloudBridgeHandler.js:191 ~ array_ids=oneTouchCbCommunicationConfig.map ~ array_ids:", array_ids)
                if (array_ids.length > 0) {
                    // const arrayLength = Math.max(...array_ids) + 1;
                    // console.log("🚀 ~ file: CloudBridgeHandler.js:194 ~ returnnewPromise ~ arrayLength:", arrayLength)

                    // const resultArray = new Array(arrayLength).fill(0); // Create an array of zeros

                    // array_ids.forEach(position => {
                    //     if (position >= 0 && position < arrayLength) {
                    //         resultArray[position - 1] = 1; // Place 1 at the specified positions
                    //     }
                    // });
                    let arrayString = array_ids.map((element, index) => element).join('-');
                    // console.log("🚀 ~ file: CloudBridgeHandler.js:273 ~ returnnewPromise ~ arrayString:", arrayString)

                    await CommunicateWithAwsIotService.publishPropertyValue(company_id, gateway_code, "ep0:sRule:SetCloudCondition", arrayString);
                    // console.log("🚀 ~ file: CloudBridgeHandler.js:226 ~ returnnewPromise ~ resultArray:", resultArray)
                }
            }
        }
        resolve()
    })
}
function manage(obj) {
    return new Promise(async (resolve, reject) => {
        if (obj.type == 'condition') {
            manageCondition(obj).catch((e) => {
                reject(e)
            });
        } else if (obj.type == 'action') {
            manageAction(obj).catch((e) => {
                // console.log("🚀 ~ file: CloudBridgeHandler.js:226 ~ returnnewPromise ~ e:", e)
                reject(e)
            });
        }
        resolve();
    })

}

module.exports = {
    manage
}