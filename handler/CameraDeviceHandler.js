
const models = require('../models');
const lodash = require('lodash');
const { Entities } = require('../utils/Entities');
let { addActivityLog } = require('../services/ActivityLogService')
const notificationQueueProducer = require('../sqs/NotificationQueueProducer')
let { getUserNotificationTokens } = require('./AlertCommunicationHandler')
const { getOccupants } = require('./OneTouchCommunicationConfig');
const { Constant } = require('../Constants');
const { getCompany } = require('../cache/Companies');
var companyId = null
const cloudBridgeQueueProducer = require('../sqs/CloudBridgeQueueProducer');
const cameraDeviceActionQueue = require('../sqs/CameraDeviceActionQueueProducer');
const safe4camera = require('../sqs/safe4CameraSqs-devProducer');
const { Op } = require('sequelize');
const AWS = require('aws-sdk');
const moment = require('moment');

let awsConfig = null
let s3 = null
if (process.env.S3_5GEN_AWS_ACCESS_KEY_ID) {
    awsConfig = {
        accessKeyId: process.env.S3_5GEN_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_5GEN_AWS_SECRET_ACCESS_KEY,
        region: process.env.S3_5GEN_AWS_REGION,
        endpoint: process.env.S3_5GEN_AWS_ENDPOINT,
    };

    s3 = new AWS.S3(awsConfig);

}



var getCameraDevice = function (camera_id) {
    return new Promise(async (resolve, reject) => {
        models.camera_devices.findOne({
            include: [
                {
                    model: models.devices,
                    as: 'gateway',
                }
            ],
            where: {
                camera_id
            }
        }).then(result => {
            resolve(result);
        }).catch(err => {
            reject(err)
        })
    })
}
var addOccupantsPermission = async function (sharer_occupant_id, receiver_occupant_id, invitation_email, company_id, is_temp_access, access_level) {
    const addOccupantsPermissions = await database.occupants_permissions.create({
        sharer_occupant_id,
        receiver_occupant_id,
        invitation_email,
        user_id: null,
        company_id,
        start_time: null,
        end_time: null,
        is_temp_access,
        access_level,
    }).then((result) => result).catch(err => {
        reject(err);
    });

    const Obj = {
        old: {},
        new: addOccupantsPermissions,
    };
    addActivityLog(Entities.camera_occupants_permissions.entity_name, Entities.camera_occupants_permissions.event_name.added,
        Obj, Entities.notes.event_name.added, receiver_occupant_id, company_id, null, receiver_occupant_id, null);
    return addOccupantsPermissions;
}
var getOccupant = function (occupant_id) {
    return new Promise(async (resolve, reject) => {
        models.occupants.findOne({
            where: {
                identity_id: occupant_id
            }
        }).then(result => {
            resolve(result);
        }).catch(err => {
            reject(err)
        })
    })
}
var getGateway = function (gateway_id) {
    return new Promise(async (resolve, reject) => {
        models.devices.findOne({
            where: {
                id: gateway_id
            }
        }).then(result => {
            resolve(result);
        }).catch(err => {
            reject(err)
        })
    })
}
var UpdateCameraDevice = function (occupant_id, camera_id, name, company_id, gateway_id, type) {
    return new Promise(async (resolve, reject) => {
        let cameraDevice = await getCameraDevice(camera_id).catch(err => {
            reject(err)
        })
        var occupants = await getOccupant(occupant_id).catch(err => {
            reject(err)
        })
        if (!cameraDevice) {
            if (!company_id) {
                const company = await getCompany(null, process.env.COMPANY_CODE).then(result => {
                    return (result);
                }).catch(err => {
                    reject(err);
                });
                company_id = company.id;
            }
            var occupants = await getOccupant(occupant_id).catch(err => {
                reject(err)
            })
            var gateway = null
            if (gateway_id) {
                gateway = await getGateway(gateway_id).catch(err => {
                    reject(err)
                })
            }
            if (occupants) {
                cameraDevice = await models.camera_devices.create({ camera_id, name, occupant_id: occupants.id, gateway_id, type, company_id })
                    .catch(err => {
                        reject(err)
                    })
                addActivityLog(Entities.camera.entity_name, Entities.camera.event_name.added, cameraDevice, Entities.notes.event_name.added, cameraDevice.id, company_id);
            }
        } else {
            if (occupants) {
                cameraDevice = await models.camera_devices.update({
                    name,
                    type,
                }, {
                    where: {
                        camera_id

                    },
                }).then((result) => {
                    let camera = models.camera_devices.findOne({
                        where: {
                            camera_id
                        }
                    }).catch(err => {
                        reject(err)
                    })
                    return (camera)
                }).catch(err => {
                    reject(err)
                });
                addActivityLog(Entities.camera.entity_name, Entities.camera.event_name.updated, cameraDevice, Entities.notes.event_name.updated, cameraDevice.id, company_id);
            }
        }

        const data = {
            camera_device_id: cameraDevice.id,
            camera_id: cameraDevice.camera_id,
            gateway_id: cameraDevice.gateway_id,
            event: {
                event: "Updated",
                type: "camera",
                value: {
                    model: cameraDevice.type,
                    name: cameraDevice.name
                }
            },
            occupant_id: occupants.identity_id,
            timestamp: new Date()
        }
        safe4camera.sendProducer(data);
        resolve(cameraDevice)
    })
}
var addCameraDevice = function (occupant_id, camera_id, name, company_id, gateway_id, type) {
    return new Promise(async (resolve, reject) => {
        let cameraDevice = await getCameraDevice(camera_id).catch(err => {
            reject(err)
        })
        var occupants = await getOccupant(occupant_id).catch(err => {
            reject(err)
        })
        if (cameraDevice && cameraDevice.occupant_id !== occupants.id) {
            await deleteCameraDevice(camera_id, company_id).catch(err => {
                reject(err)
            })
            cameraDevice = await getCameraDevice(camera_id).catch(err => {
                reject(err)
            })
        }
        if (!company_id) {
            const company = await getCompany(null, process.env.COMPANY_CODE).then(result => {
                return (result);
            }).catch(err => {
                reject(err);
            });
            company_id = company.id;
        }
        var gateway = null
        let plan_code = null;
        if (gateway_id) {
            gateway = await getGateway(gateway_id).catch(err => {
                reject(err)
            })
            if (gateway) {
                const companyExist = await getCompany(gateway.company_id).then(result => {
                    return (result);
                }).catch((error) => {
                    console.log(err);
                    throw (error);
                });
                plan_code = gateway.plan_code;
                const plan_limitations = companyExist.plan_limitations;
                let plan_limit_count = 0;
                const plan_limit_keyItem = Object.keys(plan_limitations);
                // check company exist or not
                if (plan_code != null) {
                    // check whether the plan_limitation includes plan_code or not

                    if (plan_limit_keyItem.includes(plan_code)) {
                        const plan_limit_value = plan_limitations[plan_code];
                        // get the count value of inner json
                        plan_limit_count = plan_limit_value['cameras'];
                        const plan_code_count = await models.camera_devices.count({
                            where: {
                                gateway_id,
                                plan_code: plan_code
                            }
                        }).then((result) => result)
                            .catch((error) => {
                                throw error;
                            });
                        if (plan_limit_count && plan_limit_count <= plan_code_count) {
                            plan_code = null;
                        }
                    } else {
                        plan_code = null;
                    }
                }
            }
        }

        if (occupants) {
            if (cameraDevice) {
                cameraDevice = await models.camera_devices.update(
                    {
                        name,
                        occupant_id: occupants.id,
                        gateway_id,
                        type,
                        company_id,
                        plan_code
                    },
                    {
                        where: {
                            camera_id
                        }
                    }
                );
                cameraDevice = await getCameraDevice(camera_id).catch(err => {
                reject(err)
            })
            }
            if (!cameraDevice) {
                cameraDevice = await models.camera_devices.create({ camera_id, name, occupant_id: occupants.id, gateway_id, type, company_id, plan_code })
                    .catch(err => {
                        reject(err)
                    })
            }
            if (plan_code != null) {
                const data = {
                    occupant_id: occupants.identity_id,
                    camera_id: camera_id,
                    action: {
                        type: 'subscription',
                        event: 'subscribe',
                        value: {
                            plan_code: plan_code
                        },
                    },
                    time: new Date()
                }
                // send this object in action queue
                cameraDeviceActionQueue.sendProducer(data);
            }
            const data = {
                camera_device_id: cameraDevice.id,
                camera_id: camera_id,
                gateway_id: gateway_id,
                event: {
                    event: "Added",
                    type: "camera",
                    value: {
                        model: type,
                        name: name
                    }
                },
                occupant_id: occupants.identity_id,
                timestamp: new Date()
            }
            safe4camera.sendProducer(data);
            addActivityLog(Entities.camera.entity_name, Entities.camera.event_name.added, cameraDevice, Entities.notes.event_name.added, cameraDevice.id, company_id);
        }

        resolve(cameraDevice)
    })
}

var deleteCameraDevice = function (camera_id, company_id) {
    return new Promise(async (resolve, reject) => {
        var cameraDevice = await getCameraDevice(camera_id).catch(err => {
            reject(err)
        })
        if (cameraDevice) {
            if (!company_id) {
                const company = await getCompany(null, process.env.COMPANY_CODE).then(result => {
                    return (result);
                }).catch(err => {
                    reject(err);
                });
                company_id = company.id;
            }
            // delete occupant permissions for camera
            await models.occupants_camera_permissions.destroy({
                where: {
                    camera_device_id: cameraDevice.id
                }
            }).catch(err => {
                reject(err)
            })
            // delete camera alert
            await models.device_alerts.destroy({
                where: {
                    camera_device_id: cameraDevice.id
                }
            }).catch(err => {
                reject(err)
            })
            // delete camera events
            await models.camera_events.destroy({
                where: {
                    camera_id: cameraDevice.camera_id
                }
            }).catch(err => {
                reject(err)
            })
            // delete camera device
            await models.camera_devices.destroy({
                where: {
                    id: cameraDevice.id
                }
            }).then((result) => {
                addActivityLog(Entities.camera.entity_name, Entities.camera.event_name.deleted, cameraDevice, Entities.notes.event_name.deleted, cameraDevice.id, company_id);
                resolve(result)
            }).catch(err => {
                reject(err)
            });
            let occupant = models.occupants.findOne({
                where: {
                    id: cameraDevice.occupant_id
                }
            }).then(result => {
                resolve(result);
            }).catch(err => {
                reject(err)
            })
            const data = {
                camera_device_id: cameraDevice.id,
                camera_id: camera_id,
                gateway_id: cameraDevice.gateway_id,
                event: {
                    event: "Deleted",
                    type: "camera",
                    value: {
                        model: cameraDevice.type,
                        name: cameraDevice.name
                    }
                },
                occupant_id: occupant.identity_id,
                timestamp: new Date()
            }
            safe4camera.sendProducer(data);
        }
    })
}

var sendNotification = function (camera_id, companyId, camera_name, property_name, camera_device_id, camera_occupant_id, gateway_id, type, path, property_value,) {
    return new Promise(async (resolve, reject) => {
        let occupants = await models.sequelize.query(`SELECT distinct(receiver_occupant_id) FROM occupants_camera_permissions  JOIN occupants_permissions ON
            occupants_permissions.id = occupants_camera_permissions.occupant_permission_id
             where camera_device_id = :camera_device_id`,
            {
                raw: true,
                replacements: {
                    camera_device_id: camera_device_id,
                },
                logging: console.log,
            });
         console.log("🚀  file: CameraDeviceHandler.js:163  returnnewPromise ~ occupants:", occupants);
        let occupantList = [];
        occupantList.push(camera_occupant_id)
        if (occupants && occupants.length > 0) {
            occupants[0].forEach(async (element) => {
                let receiver_occupant_id = element.receiver_occupant_id;
                if (!(occupantList.includes(receiver_occupant_id))) {
                    occupantList.push(receiver_occupant_id)
                }
            })
        }
         console.log("🚀  file: CameraDeviceHandler.js:241  returnnewPromise ~ occupantList:", occupantList);
        if (occupantList && occupantList.length > 0) {
            let data = {
                module: 'camera',
                camera_id: camera_id,
                property_name: property_name,
                property_value: property_value,
                notification_type: 'intreactive_notification',
                actions: "['snooze', 'cancel']",
                notification_action: 'camera_setting',
                camera_device_id: camera_device_id,
                click_action: "FLUTTER_NOTIFICATION_CLICK",
            }
            if (gateway_id) {
                data.gateway_id = gateway_id;
            }

            // console.log("🚀 ~ file: CameraDeviceHandler.js:290 ~ returnnewPromise ~ property_name:", property_name)

            if ((type == 'SC600' || type == 'HCX380') && path) {
                if (path.startsWith('/')) {
                    path = path.slice(1); // Remove the first character
                }
                const params = {
                    Bucket: process.env.S3_5GEN_BUCKET_NAME,
                    Key: path,
                    Expires: parseInt(process.env.SIGNED_URL_EXPIRATION),
                };
                if (s3) {
                    s3.getSignedUrl('getObject', params, (err, url) => {
                        if (err) {
                            console.error('Error generating pre-signed URL:', err);
                            return null
                        } else {
                            // console.log('Pre-signed URL:', url);
                            data["imageUrl"] = url
                        }
                    });
                } else {
                    data["imageUrl"] = process.env.MOTION_DETECTED_IMAGE_URL
                }
            }
            // else {
            //     if (property_name == 'motiondetect') {
            //         data["imageURL"] = ''
            //     }

            // }
                    console.log("🚀 ~ file: CameraDeviceHandler.js:436 ~ data:", data)

            occupantList.forEach(async (element,) => {
                // console.log("🚀 ~ file: CameraDeviceHandler.js:316 ~ occupantList.forEach ~ element:", element)
                let notificationTokenLists = [];
                const occupantsEquipmentData = await models.occupants_equipments_data.findAll({
                    include: [
                        {
                            model: models.occupants_notification_tokens,
                        }
                    ],
                    where: {
                        occupant_id: element,
                        item_id: camera_device_id,
                    }

                }).catch((err) => {
                    reject(err)
                });
                if (occupantsEquipmentData && occupantsEquipmentData.length > 0) {
                    //  console.log("🚀 ~ file: CameraDeviceHandler.js:333 ~ occupantList.forEach ~ occupantsEquipmentData:", occupantsEquipmentData)
                    occupantsEquipmentData.forEach(async (ele) => {
                        if (ele.occupants_notification_token.is_enable !== false) {
                            let cameraNotificationEnable = true
                            if (ele.occupants_notification_token && ele.occupants_notification_token.data && ele.occupants_notification_token.data.hasOwnProperty("camera_notification_enable")) {
                                cameraNotificationEnable = ele.occupants_notification_token.data.camera_notification_enable
                            }
                            if (ele.value && cameraNotificationEnable != false) {
                                //  console.log("🚀  file: CameraDeviceHandler.js:262  occupantsEquipmentData.forEach ~ ele.value:", ele.value)
                                if (ele.value.DND) {
                                    if(ele.value.DND.utc_date && ele.value.DND.hours) {
                                        // console.log("🚀 ~ file: CameraDeviceHandler.js:290 ~ occupantsEquipmentData.forEach ~ new Date(ele.value.DND.date) < new Date() == true:", new Date(ele.value.DND.date) < new Date())
                                        const compareDate = moment(ele.value.DND.utc_date).add(ele.value.DND.hours, 'hours').toDate();
                                        if (compareDate < new Date()) {
                                            if (ele.value.hasOwnProperty(property_name) && ele.value.hasOwnProperty(property_name) == true) {
                                                if (ele.value[property_name] == true) {
                                                    notificationTokenLists.push(ele.occupants_notification_token.token)
                                                    //  console.log("🚀  file: CameraDeviceHandler.js:266  occupantsEquipmentData.forEach ~ notificationTokenLists:", notificationTokenLists)
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    if (ele.value.hasOwnProperty(property_name) && ele.value.hasOwnProperty(property_name) == true) {
                                        if (ele.value[property_name] == true) {
                                            notificationTokenLists.push(ele.occupants_notification_token.token)
                                            // console.log("🚀  file: CameraDeviceHandler.js:266  occupantsEquipmentData.forEach ~ notificationTokenLists:", notificationTokenLists)
                                        }
                                    }
                                }
                            }
                        }
                    })
                } else {
                    //  console.log("🚀 ~ file: CameraDeviceHandler.js:362 ~ occupantList.forEach ~ element:", element)
                    const occupantsNotificationTokens = await models.occupants_notification_tokens.findAll({
                        where: {
                            occupant_id: element,
                            [Op.or]: [
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
                    }).catch((err) => {
                        reject(err)
                    })
                    if (occupantsNotificationTokens.length > 0) {
                        occupantsNotificationTokens.forEach(async (occupants_notification_token,) => {
                            if (occupants_notification_token.is_enable !== false) {
                                let cameraNotificationEnable = true
                                if (occupants_notification_token && occupants_notification_token.data && occupants_notification_token.data.hasOwnProperty("camera_notification_enable")) {
                                    cameraNotificationEnable = occupants_notification_token.data.camera_notification_enable
                                    if (cameraNotificationEnable == true) {
                                        notificationTokenLists.push(occupants_notification_token.token)
                                    }
                                } else if (occupants_notification_token && occupants_notification_token.data == null) {
                                    notificationTokenLists.push(occupants_notification_token.token)
                                }
                            }
                        })
                        // console.log("🚀  file: CameraDevic eHandler.js:301  occupantList.forEach ~ notificationTokenLists:", notificationTokenLists)
                    }
                }

                if (notificationTokenLists.length > 0) {
                    let where = { id: element }
                    const chooseLanguage = await getOccupants(where).then(result => {
                        return (result);
                    }).catch((err) => {
                        reject(err);
                    });
                    // console.log("data", data)
                    var object = {
                        key: property_name,
                        type: 'cameraalert',
                        language: chooseLanguage.language,
                        camera_id: camera_id,
                        company_id: companyId,
                        camera_name: camera_name,
                        notificationTokenList: notificationTokenLists,
                        notificationData: data
                    }
                    notificationQueueProducer.sendProducer(object);
                     console.log("🚀  file: CameraDeviceHandler.js:300  occupantList.forEach ~ object:", object)

                }
            });
        }
        resolve();
    })
}
var addCameraEvents = function (camera_id, property_name, property_value, companyId, path) {
    return new Promise(async (resolve, reject) => {
        if (!companyId) {
            const company = await getCompany(null, process.env.COMPANY_CODE).then(result => {
                return (result);
            }).catch(err => {
                reject(err);
            });
            companyId = company.id;
        }
        var value = {
            value: property_value
        }
        var cameraDevice = await getCameraDevice(camera_id).catch((err) => {
            reject(err)
        })
        if (cameraDevice) {
            let occupant = models.occupants.findOne({
                where: {
                    id: cameraDevice.occupant_id
                }
            }).then(result => {
                resolve(result);
            }).catch(err => {
                reject(err)
            })
            const camera_events = await models.camera_events.create({ camera_id, property_name, property_value: value, company_id: companyId })
                .then((result) => {
                    return (result)
                }).catch(err => {
                    reject(err)
                })
            let key = 'constants'
            let constants = await Constant(key)
            let property_name_array = constants.cameraNotificationList
            if (property_name_array.includes(property_name) === true &&( property_value != 0 || property_value != '0') ) {
                await sendNotification(camera_id, companyId, cameraDevice.name, property_name, cameraDevice.id, cameraDevice.occupant_id, cameraDevice.gateway_id, cameraDevice.type, path, property_value).catch((err) => {
                    reject(err);
                })
            }
            if (cameraDevice.gateway) {
                let data = {
                    "gateway_code": cameraDevice.gateway.device_code,
                    "camera_id": camera_id,
                    "property_name": property_name,
                    "property_value": property_value,
                    "type": "condition",
                    "company_id": companyId
                }
                cloudBridgeQueueProducer.sendProducer(data);
                const info = {
                    camera_device_id: cameraDevice.id,
                    camera_id: camera_id,
                    gateway_id: cameraDevice.gateway_id,
                    event: {
                        name: property_name,
                        type: "device_event",
                        value: property_value
                    },
                    occupant_id: occupant.identity_id,
                    timestamp: new Date()
                }
                safe4camera.sendProducer(info);
            }

            resolve(camera_events);
        }
        resolve()

    })
}
var addDeviceAlert = function (alert_type, alert_code, camera_device_id, company_id) {
    return new Promise(async (resolve, reject) => {

        var device_alert = await models.device_alerts.findOne({
            where: {
                alert_code, camera_device_id, company_id
            }
        }).then(result => { return result })
            .catch(err => {
                reject(err)
            })
        if (!device_alert) {
            await models.device_alerts.create({
                alert_type, alert_code, camera_device_id, company_id, severity: 'low'
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
var removeDeviceAlert = function (alert_type, alert_code, camera_device_id, company_id) {
    return new Promise(async (resolve, reject) => {
        await models.device_alerts.destroy({
            where: {
                alert_code, camera_device_id, company_id
            }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}
var manageCameraDeviceAlerts = function (alert_codes, camera_id, property_name, property_value, companyId) {
    return new Promise(async (resolve, reject) => {
        if (!companyId) {
            const company = await getCompany(null, process.env.COMPANY_CODE).then(result => {
                return (result);
            }).catch(err => {
                reject(err);
            });
            companyId = company.id;
        }
        let cameraDevice = await getCameraDevice(camera_id).catch(err => {
            reject(err)
        })
        if (cameraDevice) {
            let camera_device_id = cameraDevice.id
            for (const alert_code of alert_codes) {
                if (alert_code === property_name) {
                    var alert_type = alert_code
                    if (property_value === false || property_value === 'false' || property_value === 0) {
                        await removeDeviceAlert(alert_type, alert_code, camera_device_id, companyId).then(result => { result })
                            .catch(err => {
                                reject(err);
                            })
                    }
                    if (property_value === true || property_value === 'true' || property_value === 1) {
                        await addDeviceAlert(alert_type, alert_code, camera_device_id, companyId).then(result => { result })
                            .catch(err => {
                                reject(err);
                            })
                    }
                }
            }
        }
        resolve()
    })
}
var manageCameraDeviceEventQueue = function (obj) {
    return new Promise(async (resolve, reject) => {
        if (obj.event?.type == 'camera' && obj.event?.event == 'Added') {
            // console.log("🚀  file: CameraDeviceHandler.js:398  returnnewPromise ~ obj:", obj)
            let { occupant_id, camera_id, } = obj;
            let name = decodeURI(obj.event.value.name);
            let gateway_id = obj.event.value.gateway_id
            let type = decodeURI(obj.event.value.model);
            addCameraDevice(occupant_id, camera_id, name, companyId, gateway_id, type)
                .then((result) => {
                    resolve(result)
                }).catch(err => {
                    reject(err)
                })
        } else if (obj.event?.type == 'camera' && obj.event?.event == 'Deleted') {
            let { camera_id } = obj
            deleteCameraDevice(camera_id, companyId).then((result) => {
                resolve(result)
            }).catch(err => {
                reject(err)
            })
        } else if (obj.event?.type == 'camera' && obj.event?.event == 'Updated') {
            let { occupant_id, camera_id, } = obj;
            let name = decodeURI(obj.event.value.name);
            let gateway_id = obj.event.value.gateway_id
            let type = decodeURI(obj.event.value.model);
            UpdateCameraDevice(occupant_id, camera_id, name, companyId, gateway_id, type)
                .then((result) => {
                    resolve(result)
                }).catch(err => {
                    reject(err)
                })
        } else if (obj.event?.type == 'device_event') {
            let { camera_id } = obj
            let property_name = obj.event.name
            let property_value = obj.event.value
            let path = null
            if (obj.event.path) {
                path = obj.event.path
            }

            let key = 'constants'
            let constants = await Constant(key)
            var alert_codes = constants.cameraAlertsList
            await addCameraEvents(camera_id, property_name, property_value, companyId, path).then(async (result) => {
                await manageCameraDeviceAlerts(alert_codes, camera_id, property_name, property_value, companyId).catch(err => {
                    reject(err);
                });
                resolve(result)
            }).catch(err => {
                reject(err)
            })
        }

    })
}

module.exports = {
    manageCameraDeviceEventQueue
}
