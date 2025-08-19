const models = require('../models');
const AWS = require('aws-sdk');
const lodash = require('lodash');
const { Op } = models.Sequelize;
const { getFromTable } = require('../dynamodb');
const Logger = require('../Logger');
const { setInCache, getOneFromCache } = require('../cache/Cache')
var emailQueueProducer = require('../sqs/EmailQueueProducer')
var smsQueueProducer = require('../sqs/SMSQueueProducer')
var notificationQueueProducer = require('../sqs/NotificationQueueProducer')
const { getCompany } = require('../cache/Companies');
var companyId = null
var companyCreds = null


var getUserCredentials = function (cognitoID) {
    return new Promise((resolve, reject) => {
        const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();
        var params = {
            "UserPoolId": companyCreds.aws_cognito_user_pool,
            "Filter": "sub = \"" + cognitoID + "\""
        }
        cognitoidentityserviceprovider.listUsers(params, (err, data) => {
            if (err) {
                reject(err)
            } else {
                resolve(data.Users);
            }// successful response
        });
    })
}
var getAlertTypes = function (AlertType) {
    return new Promise((resolve, reject) => {

        var params = {
            TableName: 'AlertTypes',
            FilterExpression: "#alert_type = :alert_type_val",
            ExpressionAttributeNames: {
                "#alert_type": "AlertType",
            },
            ExpressionAttributeValues: {
                ":alert_type_val": AlertType
            }
        };
        getFromTable(params).then(result => {

            if (result && result.length > 0) {
                resolve(result[0])
            } else {
                resolve(null)
            }
        }).catch((err) => {
            reject(err);
        });


    })
}
var getUserAlertConfig = function (deviceCode, AlertType) {
    return new Promise((resolve, reject) => {
        var params = {
            TableName: 'UserAlertConfig',
            FilterExpression: "#device_id = :device_id_val and #alert_type = :alert_type_val",
            ExpressionAttributeNames: {
                "#device_id": "DeviceID",
                "#alert_type": "AlertType"
            },
            ExpressionAttributeValues: {
                ":device_id_val": deviceCode,
                ":alert_type_val": AlertType
            }
        };
        getFromTable(params).then(result => {
            resolve(result)
        }).catch((err) => {
            reject(err);
        });
    })
}
var getUserAttributes = function (userid) {
    return new Promise((resolve, reject) => {
        var params = {
            TableName: 'UserAttributes',
            FilterExpression: "#user_id = :user_id_val",
            ExpressionAttributeNames: {
                "#user_id": "userid"
            },
            ExpressionAttributeValues: {
                ":user_id_val": userid,
            }
        };
        getFromTable(params).then(result => {
            resolve(result)
        }).catch((err) => {
            reject(err);
        });
    })
}
var getUserNotificationTokens = function (UserId) {
    return new Promise((resolve, reject) => {
        var params = {
            TableName: 'UserNotificationTokens',
            FilterExpression: "#userid = :userid_val",
            ExpressionAttributeNames: {
                "#userid": "userid"
            },
            ExpressionAttributeValues: {
                ":userid_val": UserId
            }
        };
        getFromTable(params).then(result => {
            resolve(result)
        }).catch((err) => {
            reject(err);
        });
    })
}
var getAlertType = function (alert_type) {
    return new Promise((resolve, reject) => {
        models.alert_types.findOne({
            where: { alert_type }
        })
            .then(result => {
                resolve(result)
            }).catch((err) => {
                reject(err);
            });
    })
}
var addAlertType = function (alert_type) {
    return new Promise((resolve, reject) => {
        const defaultValues = {
            severity: 'Low',
            defaultMessage: alert_type + " notify message",
            email: { delay: 60, isEnable: false },
            sms: { delay: 60, isEnable: false },
            notification: { delay: 60, isEnable: false },
            placeholders: {},
        }
        getAlertType(alert_type).then(alertTypeObj => {
            if (!alertTypeObj) {
                models.alert_types.create({
                    alert_type, severity: defaultValues.severity, defaultMessage: defaultValues.defaultMessage, email: defaultValues.email, sms: defaultValues.sms, notification: defaultValues.notification, placeholders: defaultValues.placeholders
                }).then(result => {
                    resolve(result)
                }).catch(err => {
                    reject(err);
                })
            } else {
                resolve(result)
            }
        }).catch(err => {
            reject(err);
        })
    })
}
var getDeviceInfo = function (condition) {
    return new Promise((resolve, reject) => {
        models.devices.findOne({
            attributes: ["id", "name", "model", "device_code", "gateway_id", "location_id"],
            where: condition
        }).then(obj => {
            if (obj) {
                var data = {
                    id: obj.id,
                    name: obj.name,
                    model: obj.model,
                    device_code: obj.device_code,
                    gateway_id: obj.gateway_id,
                    location_id: obj.location_id
                }
                resolve(data);
            } else {
                resolve(null);
            }
        }).catch((err) => {
            reject(err);
        });
    })
}
var getLocationInfo = async function (location_id) {
    return new Promise((resolve, reject) => {
        models.locations.findOne({
            attributes: ["path"],
            where: {
                id: location_id
            }
        }).then(obj => {
            if (obj) {
                resolve(obj)
            } else {
                resolve(null)
            }
        }).catch((err) => {
            reject(err)
        });
    })

}
// add alert
var addStatusHistory = function (data, type) {
    return new Promise(async (resolve, reject) => {
        const splitArr = data.deviceCode.split('-');
        const gateway_code = `${splitArr[0]}-${splitArr[1]}`;
        var values = {}
        values["company_id"] = companyId
        values["alert_type"] = data.alert_type
        values["severity"] = data.severity
        values["alert_msg"] = data.alertMessage
        var device = await getDeviceInfo({
            "device_code": data.deviceCode,
            "company_id": companyId
        }).then(result => {
            return result
        });

        if (device) {
            var gateway = await getDeviceInfo({
                "device_code": gateway_code,
            }).then(result => {
                return result
            })
            values["device"] = device
            values["gateway"] = gateway
            var location_id = device.location_id

            if (location_id) {
                var location = await getLocationInfo(location_id).then(result => {
                    return result
                })
                if (location && location.path) {
                    var locationObj = {
                        site: null,
                        building: null,
                        floor: null,
                        room: null,
                        street: null,
                        area: null,
                        house: null
                    }
                    var location_keys = Object.keys(location.path);
                    location_keys.splice(location_keys.indexOf('breadcrumb'), 1);
                    location_keys.forEach(element => {
                        if (location.path[element].site) {
                            locationObj.site = {
                                id: element,
                                name: location.path[element].site
                            }
                        } else if (location.path[element].building) {
                            locationObj.building = {
                                id: element,
                                name: location.path[element].building
                            }
                        } else if (location.path[element].floor) {
                            locationObj.floor = {
                                id: element,
                                name: location.path[element].floor
                            }
                        } else if (location.path[element].room) {
                            locationObj.room = {
                                id: element,
                                name: location.path[element].room
                            }
                        } else if (location.path[element].street) {
                            locationObj.street = {
                                id: element,
                                name: location.path[element].street
                            }
                        } else if (location.path[element].area) {
                            locationObj.area = {
                                id: element,
                                name: location.path[element].area
                            }
                        } else if (location.path[element].house) {
                            locationObj.house = {
                                id: element,
                                name: location.path[element].house
                            }
                        }
                    });

                    values["location"] = locationObj
                }

            }
            // models.device_status_histories.create(values)
            //     .then(async (result) => {
            //         await setInCache("DeviceAlerts", data.deviceCode + type, data.alert_type, 0)
            //         resolve(result)
            //     }).catch(err => {
            //         reject(err)
            //     })
        }
        else {}

    })
}

var checkPreviousAlert = function (deviceCode, type) {
    return new Promise(async (resolve, reject) => {
        var alertType = await getOneFromCache("DeviceAlerts", deviceCode + type)
        resolve(alertType)
    })
}
//add status action
// var addStatusAction = function (data) {
//     return new Promise((resolve, reject) => {
//         models.device_status_actions.create(data)
//             .then(result => {
//                 resolve(result)
//             }).catch(err => {
//                 reject(err)
//             })
//     })
// }
//manage adding status action to calling perticuler queue
// var manageStatusActions = function (dataList) {
//     return new Promise((resolve, reject) => {
//         if (dataList.length > 0) {
//             dataList.forEach((element, index) => {
//                 models.device_status_actions.create(element.data)
//                     .then(result => {
//                         if (index == (dataList.length - 1)) {
//                             resolve(result)
//                         }
//                     }).catch(err => {
//                         reject(err)
//                     })
//             });
//         } else {
//             resolve()
//         }
//     })
// }
/**
 *
 * get Alert type from AlertTypes
 * getAlertConfigs from UserAlertConfig 
 * then add to perticuler queue ,Notification queue, SMS queue, Email Queue
 */
//to manage multiple alert configs 
var manageAlertConfig = function (alertConfigList, alertId, alertTypeObj, deviceCode) {
    return new Promise(async (resolve, reject) => {
        var emailKey = alertTypeObj.alert_type + "_" + deviceCode + "_email"
        var smsKey = alertTypeObj.alert_type + "_" + deviceCode + "_sms"
        var notificationKey = alertTypeObj.alert_type + "_" + deviceCode + "_notification"

        var emailIsDelayed = await getOneFromCache("AlertHistory", emailKey)
        var smsIsDelayed = await getOneFromCache("AlertHistory", smsKey)
        var notificationIsDelayed = await getOneFromCache("AlertHistory", notificationKey)

        if (!emailIsDelayed && alertTypeObj.email.delay > 0) {
            await setInCache("AlertHistory", emailKey, alertTypeObj, alertTypeObj.email.delay)
        }
        if (!smsIsDelayed && alertTypeObj.sms.delay > 0) {
            await setInCache("AlertHistory", smsKey, alertTypeObj, alertTypeObj.sms.delay)
        }
        if (!notificationIsDelayed && alertTypeObj.notification.delay > 0) {
            await setInCache("AlertHistory", notificationKey, alertTypeObj, alertTypeObj.notification.delay)
        }
        alertConfigList.forEach(async (element, index) => {

            var sendEmail = element.EmailEnabled
            var sendSMS = element.SMSEnabled
            var sendNotification = element.NotificationEnabled
            var userAttributes = await getUserAttributes(element.userid).catch(err => {
                reject(err)
            })

            if (userAttributes && userAttributes.length > 0 && userAttributes[0].UserSub) {
                var cognitoId = userAttributes[0].UserSub
                getUserCredentials(cognitoId).then(async (userCred) => {
                    if (userCred && userCred.length > 0) {
                        var emailObj = lodash.filter(userCred[0].Attributes, [
                            'Name',
                            'email',
                        ]);
                        var nameObj = lodash.filter(userCred[0].Attributes, [
                            'Name',
                            'name',
                        ]);
                        var phoneNumberObj = lodash.filter(userCred[0].Attributes, [
                            'Name',
                            'phone_number',
                        ]);
                        var email = null
                        var phoneNumber = null
                        var name = null
                        if (emailObj.length > 0) {
                            email = emailObj[0].Value
                        }
                        if (phoneNumberObj.length > 0) {
                            phoneNumber = phoneNumberObj[0].Value
                        }
                        if (nameObj.length > 0) {
                            name = nameObj[0].Value
                        }
                        var notificationTokenLists = await getUserNotificationTokens(element.userid)
                        var dataList = []
                        if (email && sendEmail && alertTypeObj.email.isEnable && !emailIsDelayed) {
                            var data = {
                                notes: "email sent",
                                device_alert_id: alertId,
                                status: "notified",//acknowledge
                                user_id: element.userid,
                                entity: "email",
                                entity_value: email,
                                company_id: companyId
                            }
                            var obj = {
                                email: email,
                                alert_type: alertTypeObj.alert_type,
                                key: alertTypeObj.alert_type,
                                type: "alert",
                                name: name,
                                alert_message: element.AlertMessage,
                                device_code: element.DeviceID,
                                receiverList: [{ email: email }]
                            }
                            // emailQueueProducer.sendProducer(obj)
                            dataList.push({
                                data: data
                            })
                        }
                        if (phoneNumber && sendSMS && alertTypeObj.sms.isEnable && !smsIsDelayed) {

                            var data = {
                                notes: "sms sent",
                                device_alert_id: alertId,
                                status: "notified",
                                user_id: element.userid,
                                entity: "sms",
                                entity_value: phoneNumber,
                                company_id: companyId
                            }
                            var obj = {
                                phoneNumber: phoneNumber,
                                alert_type: alertTypeObj.alert_type,
                                key: alertTypeObj.alert_type,
                                type: "alert",
                                name: name || null,
                                alert_message: element.AlertMessage,
                                device_code: element.DeviceID,
                                phoneNumberList: [{ phoneNumber }]
                            }
                            // smsQueueProducer.sendProducer(obj)
                            dataList.push({
                                data: data
                            })
                        }
                        if (notificationTokenLists.length > 0 && sendNotification && alertTypeObj.notification.isEnable && !notificationIsDelayed) {
                            var data = {
                                notes: "notification sent",
                                device_alert_id: alertId,
                                status: "notified",
                                user_id: element.userid,
                                entity: "notification",
                                entity_value: "",
                                company_id: companyId
                            }
                            var obj = {
                                email: email || null,
                                alert_type: alertTypeObj.alert_type,
                                key: alertTypeObj.alert_type,
                                type: "alert",
                                name: name || null,
                                alert_message: element.AlertMessage,
                                device_code: element.DeviceID,
                                notificationTokenList: notificationTokenLists
                            }
                            // notificationQueueProducer.sendProducer(obj)
                            dataList.push({
                                data: data
                            })

                        }
                        manageStatusActions(dataList)
                            .then(result => {

                            }).catch(err => {
                                reject(err)
                            })
                    }
                }).catch(err => {
                    reject(err)
                })
            }

            if (alertConfigList.length - 1 == index) {
                resolve()
            }
        });
    })
}
var managePsqlAlertConfig = function (alertConfigList, alertId, alertTypeObj, deviceCode) {
    return new Promise(async (resolve, reject) => {
        var emailKey = alertTypeObj.alert_type + "_" + deviceCode + "_email"
        var smsKey = alertTypeObj.alert_type + "_" + deviceCode + "_sms"
        var notificationKey = alertTypeObj.alert_type + "_" + deviceCode + "_notification"
        var emailIsDelayed = await getOneFromCache("AlertHistory", emailKey)
        var smsIsDelayed = await getOneFromCache("AlertHistory", smsKey)
        var notificationIsDelayed = await getOneFromCache("AlertHistory", notificationKey)

        if (!emailIsDelayed && alertTypeObj.email.delay > 0) {
            await setInCache("AlertHistory", emailKey, alertTypeObj, alertTypeObj.email.delay)
        }
        if (!smsIsDelayed && alertTypeObj.sms.delay > 0) {
            await setInCache("AlertHistory", smsKey, alertTypeObj, alertTypeObj.sms.delay)
        }
        if (!notificationIsDelayed && alertTypeObj.notification.delay > 0) {
        }
        alertConfigList.forEach(async (element, index) => {
            var sendEmail = element.email_enabled
            var sendSMS = element.sms_enabled
            var sendNotification = element.notification_enabled
            var cognitoId = null
            var email = null
            var phoneNumber = null
            var name = null
            var notificationTokenLists = []
            if (element.user) {
                cognitoId = element.user.cognito_id
                email = element.user.email
                phoneNumber = element.user.phone_number
            }
            if (element.occupant) {
                cognitoId = element.occupant.cognito_id
                email = element.occupant.email
                phoneNumber = element.occupant.phone_number
                notificationTokenLists = await getUserNotificationTokens(element.occupant.identity_id)
            }
            if (email && sendEmail && alertTypeObj.email.isEnable && !emailIsDelayed) {
                var obj = {
                    email: email,
                    alert_type: alertTypeObj.alert_type,
                    key: alertTypeObj.alert_type,
                    type: "alert",
                    name: name,
                    alert_message: element.alert_message,
                    device_code: element.device.device_code,
                    receiverList: [{ email: email }]
                }
                // emailQueueProducer.sendProducer(obj)
            }
            if (phoneNumber && sendSMS && alertTypeObj.sms.isEnable && !smsIsDelayed) {
                var obj = {
                    phoneNumber: phoneNumber,
                    alert_type: alertTypeObj.alert_type,
                    key: alertTypeObj.alert_type,
                    type: "alert",
                    name: name || null,
                    alert_message: element.alert_message,
                    device_code: element.device.device_code,
                    phoneNumberList: [{ phoneNumber }]
                }
                // smsQueueProducer.sendProducer(obj)

            }
            if (notificationTokenLists.length > 0 && sendNotification && alertTypeObj.notification.isEnable && !notificationIsDelayed) {
                var obj = {
                    email: email || null,
                    alert_type: alertTypeObj.alert_type,
                    key: alertTypeObj.alert_type,
                    type: "alert",
                    name: name || null,
                    alert_message: element.alert_message,
                    device_code: element.device.device_code,
                    notificationTokenList: notificationTokenLists
                }
                // notificationQueueProducer.sendProducer(obj)
            }

            if (alertConfigList.length - 1 == index) {
                resolve()
            }
        });
    })
}
var getAlertConfig = function (device_code, alert_type) {
    return new Promise((resolve, reject) => {
        models.alert_communication_configs.findAll({
            include: [
                {
                    require: true,
                    model: models.devices,
                    where: {
                        device_code
                    }
                }, {
                    model: models.users
                }, {
                    model: models.occupants
                }
            ],
            where: { alert_type }
        }).then(result => {
            resolve(result)
        }).catch((err) => {
            reject(err);
        });
    })
}

var manageAlert = function (deviceCode, type, alertId, alertTypeObj) {
    return new Promise((resolve, reject) => {
        getUserAlertConfig(deviceCode, type)
            .then(async (alertConfigList) => {
                getAlertConfig(deviceCode, type)
                    .then(async (psqlAlertConfigList) => {

                        if ((alertConfigList && alertConfigList.length > 0) || (psqlAlertConfigList && psqlAlertConfigList.length > 0)) {
                            if (alertConfigList) {
                                manageAlertConfig(alertConfigList, alertId, alertTypeObj, deviceCode).then(result => {

                                    resolve()
                                }).catch(err => {
                                    reject(err)
                                })
                            }
                            if (psqlAlertConfigList) {
                                managePsqlAlertConfig(psqlAlertConfigList, alertId, alertTypeObj, deviceCode).then(result => {

                                    resolve()
                                }).catch(err => {
                                    reject(err)
                                })
                            }
                        } else {
                            var data = {
                                notes: "no config found",
                                device_alert_id: alertId,
                                status: "noConfig",
                                user_id: null,
                                entity: null,
                                entity_value: null,
                                company_id: companyId
                            }
                            addStatusAction(data)
                                .then(result => {
                                    resolve()
                                }).catch(err => {
                                    reject(err)
                                })
                        }
                    })
                    .catch(err => {
                        reject(err)
                    })
            })
            .catch(err => {
                reject(err)
            })



    })
}
//to manage rules
var manage = function (obj, pointer) {
    return new Promise(async (resolve, reject) => {
        try {
            if (obj) {
                const company = await getCompany(null, process.env.COMPANY_CODE).then(result => {
                    return (result);
                }).catch(err => {
                    reject(err);
                });
                if (!company || !company.id) {
                    Logger.info("Info-Error", { "message": "Environment variable COMPANY_CODE is wrong, not found COMPANY_CODE to postgres db.", value: process.env.COMPANY_CODE })
                    resolve()
                }
                if (!companyId) {
                    companyId = company.id
                    companyCreds = company
                    AWS.config.update({
                        region: companyCreds.aws_region,
                        accessKeyId: companyCreds.aws_iam_access_key,
                        secretAccessKey: companyCreds.aws_iam_access_secret
                    });

                }
                var deviceCode = obj.topic_name
                var rulePassedList = obj.rulePasssedList

                rulePassedList.forEach((element, index) => {
                    var alertType = element.alertType
                    var type = element.type
                    if (!alertType) {
                        Logger.info("Info-Error", { "msg": "Alert type missing in alert-queue object.", value: alertType })
                        resolve()
                    } else {
                        getAlertType(alertType).then(async (alertTypeObj) => {
                            if (!alertTypeObj) {
                                alertTypeObj = await addAlertType(alertType).catch((error) => { reject(error) })
                            }
                            var action = {
                                alert_type: alertTypeObj.alert_type, severity: alertTypeObj.severity, alertMessage: alertTypeObj.default_message, deviceCode: deviceCode
                            }
                            checkPreviousAlert(deviceCode, type)
                                .then(previousAlertType => {
                                    if (previousAlertType && previousAlertType == alertType) {
                                        //add one column delay, and mention the delay required.
                                    } else {
                                        addStatusHistory(action, type).then(result => {
                                            manageAlert(deviceCode, alertTypeObj.alert_type, result.id, alertTypeObj)
                                                .then(result => {
                                                    if (index == rulePassedList.length - 1) {
                                                        resolve(result)
                                                    }
                                                })
                                                .catch(err => {
                                                    reject(err)
                                                })
                                        }).catch(err => {
                                            reject(err)
                                        })
                                    }

                                })
                                .catch(err => {
                                    reject(err)
                                })


                        }).catch(err => {
                            reject(err)
                        })
                    }
                });

            }
        } catch (error) {
            reject(error)
        }

    })

}

module.exports = {
    manage
}

