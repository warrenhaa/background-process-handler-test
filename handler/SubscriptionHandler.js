const models = require('../models');
const cameraDeviceActionQueue = require("../sqs/CameraDeviceActionQueueProducer");

var getGateway = function (device_code) {
    return new Promise(async (resolve, reject) => {
        models.devices.findOne({
            where: {
                device_code: device_code
            }
        }).then(result => {
            console.log("🚀 ~ file: SubscriptionHandler.js:10 ~ result:", result)
            resolve(result);
        }).catch(err => {
            reject(err)
        })
    })
}

//update devices
var updateDevices = function (id, data) {
    return new Promise((resolve, reject) => {
        models.devices.update(data, {
            where: { id: id }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

//update camera devices
var updateCameraDevices = function (gateway_id, data) {
    return new Promise((resolve, reject) => {
        models.camera_devices.update(data, {
            where: { gateway_id: gateway_id }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

var manageCameraSubscriptionQueue = function (obj) {
    return new Promise(async (resolve, reject) => {
        console.log("🚀  file: SubscriptionHandler.js:45  manageCameraSubscriptionActionEventQueue ~ obj", obj)
        let { metadata, subscription_id, event_id, user_id, plan_id, product_id, status, plan_code } = obj;
        let device_id = metadata.device_id;
        console.log("🚀 ~ file: SubscriptionHandler.js:48 ~ device_id:", device_id)
        if (status != "active" && status != "trial") {
            // cancel the plan for that gateway, devices and cameras
            var cancelPlan = await cancelSubscriptonPlan(device_id, status, obj)
                .catch(err => {
                    console.log("🚀  file: SubscriptionHandler.js:51  .then ~ err", err)
                    reject(err)
                })
        } else {
            if (plan_code == 'startup' || plan_code == 'advanced' || plan_code == 'advance' ) {
                const plan_code_update = plan_code;
                console.log("🚀 ~ file: SubscriptionHandler.js:58 ~ plan_code_update:", plan_code_update)
                // check gateway record is present
                var device = await getGateway(device_id).catch(err => {
                    console.log("🚀 ~ file: SubscriptionHandler.js:61 ~ err:", err)
                    reject(err)
                });
                // console.log("🚀  file: SubscriptionHandler.js:61  device ~ device", device);

                if (device) {
                    const devices_id = device.id;
                    const update_data = { plan_code: plan_code_update };
                    updateDevices(devices_id, update_data)
                        .then((result) => {
                             console.log("🚀  file: SubscriptionHandler.js:68  .then ~ result", result)
                            resolve(result)
                        }).catch(err => {
                            console.log("🚀  file: SubscriptionHandler.js:71  .catch ~ err", err)
                            reject(err)
                        });
                    // updating camera devices plan_code to received data
                    // updateCameraDevices(devices_id, update_data)
                    //     .then((result) => {
                    //          console.log("🚀  file: SubscriptionHandler.js:76  .then ~ result", result)
                    //         resolve(result)
                    //     }).catch(err => {
                    //         console.log("🚀  file: SubscriptionHandler.js:79  .catch ~ err", err)
                    //         reject(err)
                    //     });
                }
            }
        }

    })
}

var cancelSubscriptonPlan = function (device_code, status, obj) {
    return new Promise(async (resolve, reject) => {
        //console.log("🚀  file: SubscriptionHandler.js:91  cancelSubscriptonPlan ~ obj", obj)
        let { subscription_id, event_id, user_id, plan_id, product_id, plan_code } = obj;
        // check gateway record is present

        var device = await getGateway(device_code).catch(err => {
            reject(err);
        })
        //console.log("🚀  file: cancelSubscriptonPlan.js:98  device ~ device", device);

        if (device) {
            const update_data = { plan_code: null };
            const device_id = device.id;
            // updating devices plan_code to null
           updateDevices(device_id, update_data)
                .then((result) => {
                    // console.log("🚀  file: cancelSubscriptonPlan.js:106  .then ~ result", result)
                    resolve(result)
                }).catch(err => {
                    console.log("🚀  file: cancelSubscriptonPlan.js:106   .catch ~ err", err)
                    reject(err)
                });
            // updating gateways devices plan_code to null
            // not implemented yet

            // updating camera devices plan_code to null
            updateCameraDevices(device_id, update_data)
                .then((result) => {
                    //console.log("🚀  file:updateCameraDevices   SubscriptionHandler.js:124  .then ~ result", result)
                    resolve(result)
                }).catch(err => {
                    console.log("🚀  file: SubscriptionHandler.js:121  .catch ~ err", err)
                    reject(err)
                });

            // sending unsubscribe event to camera
            let cameraDevices = await models.camera_devices.findAll({
                where: {
                    gateway_id: device_id,
                },
            });

            if (cameraDevices && cameraDevices.length > 0) {
                cameraDevices.forEach(async (cameraDevice) => {
                    let occupant = await models.occupants.findOne({
                        where: {
                            id: cameraDevice.occupant_id,
                        },
                    });

                    const data = {
                        occupant_id: occupant.identity_id,
                        camera_id: cameraDevice.camera_id,
                        action: {
                            type: 'subscription',
                            event: 'unsubscribe',
                            value: {
                                plan_code: null
                            },
                        },
                        time: new Date()
                    }
                    cameraDeviceActionQueue.sendProducer(data);
                    // console.log("🚀  file: SubscriptionHandler.js:151 send event to cameras", JSON.stringify(data))
                });
            }
        }

    })
}

module.exports = {
    manageCameraSubscriptionQueue
}