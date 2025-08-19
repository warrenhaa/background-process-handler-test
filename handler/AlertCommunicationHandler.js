//manage
//you will get alert_type,device_code/device_id
//get records from alert_communication_config where alert_type,device_id and one of true
//need to run for loop on them
//and check what action needs to be performed , 
//take alert_config object from companies table,check what are enabled ,
//alert related information will be present in alert_types table,get that info make object and perform respective action
//respective action means send email,sms,or notification

const models = require('../models');
const lodash = require('lodash');
const emailQueueProducer = require('../sqs/EmailQueueProducer')
const smsQueueProducer = require('../sqs/SMSQueueProducer')
const notificationQueueProducer = require('../sqs/NotificationQueueProducer')
const Logger = require('../Logger');
const DeviceDeleteHandler = require('./DeviceDeleteHandler');
const validatePhoneNumber = require('google-libphonenumber').PhoneNumberUtil.getInstance();
const { setInCache, getOneFromCache } = require('../cache/Cache');
const { Entities } = require('../utils/Entities');

const {
    Op,
} = models.Sequelize;



const getAllOccupantsMetadata = function (occupant_id) {
    return new Promise((resolve, reject) => {
        models.occupants_metadata.findAll({
            where: { occupant_id }
        })
            .then(result => {
                let phone_number = [];
                // split key by underscore and choose [0] th position and serch for the key,
                // if found combine both and make a ph_no
                for (let item in result) {
                    const element = result[item];
                    const key = element.key;
                    if (key.includes('_')) {
                        let search_element = key.split('_');
                        search_element = search_element[0];
                         // second for loop to check search_key matches for any other elements.
                        for (let i in result) {
                            const ele = result[i];
                            const option_key = ele.key;
                            if (JSON.stringify(ele) !== JSON.stringify(element)) {
                                if (search_element === option_key) {
                                    if ((key.includes('_country_code'))) {
                                        const create_no = element.value + ele.value;
                                        phone_number.push(create_no);
                                    }
                                }
                            }
                        }
                    }
                }
                resolve(phone_number)
            }).catch((err) => {
                reject(err);
            });
    })
}


const getAlertConfigs = function (alertType, deviceId) {
    return new Promise((resolve, reject) => {
        models.alert_communication_configs.findAll({
            include: [
                {
                    require: true,
                    model: models.devices,
                    where: {
                        id: deviceId
                    }
                }, {
                    model: models.users
                }, {
                    model: models.occupants
                },
                {
                    model: models.companies
                }
            ],
            where: {
                alert_type: alertType,
                device_id: deviceId,
                [Op.or]: [
                    { sms_enabled: true },
                    { email_enabled: true },
                    { notification_enabled: true }
                ]
            }
        })
            .then(result => {
                resolve(result)
            }).catch((err) => {
                reject(err);
            });
    })
}

// const getAlertTypes = function (alertType) {
//     return new Promise((resolve, reject) => {
//         models.alert_types.findOne({
//             where: {
//                 alert_type: alertType,
//             }
//         })
//             .then(result => {
//                 resolve(result)
//             }).catch((err) => {
//                 reject(err);
//             });
//     })
// }

const getAlertConditions = function (alertType, language, alertConfig) {
    return new Promise(async (resolve, reject) => {
        let alert_key = null;
        let lowBatteryTypes = ['ErrorIASZSLowBattery', 'Error32', 'TRVError22', 'ErrorPowerSLowBattery', 'lowBattery'];
        let templateExist = {};

        if (alertType && lowBatteryTypes.includes(alertType)) {
            alert_key = 'Alert.LowBattery';
            // findOne if template exist
            templateExist = await models.template_contents.findOne({
                where: {
                    key: alert_key, language,
                }
            }).then(result => {
                return (result)
            }).catch((err) => {
                reject(err);
            });
        } else if (alertType == 'ErrorLossLinkStatus') {
            alert_key = 'Alert.LossLink';
            // findOne if template exist
            templateExist = await models.template_contents.findOne({
                where: {
                    key: alert_key, language,
                }
            }).then(result => {
                return (result)
            }).catch((err) => {
                reject(err);
            });
        }
        else if (alertType == 'connected') {
            alert_key = 'Alert.connected';
            // findOne if template exist
            templateExist = await models.template_contents.findOne({
                where: {
                    key: alert_key, language,
                }
            }).then(result => {
                return (result)
            }).catch((err) => {
                reject(err);
            });
        }
                
        if (templateExist && Object.keys(templateExist).length > 0) {
            alert_key = templateExist.key;
        } else {
            alert_key = alertConfig.key;
        }
        resolve({alert_key});
    })
}

const getUserNotificationTokens = function (occupantId) {
    return new Promise((resolve, reject) => {
        models.occupants_notification_tokens.findAll({
            where: {
                occupant_id: occupantId,
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
        })
            .then(result => {
                resolve(result)
            }).catch((err) => {
                reject(err);
            });
    })
}

const manageSendAlert = function (alertConfigList, alertType, deviceId, obj) {
    return new Promise(async (resolve, reject) => {
        var alertConfig = {
            email: {
                delay: 300
            },
            sms: {
                delay: 300
            },
            notification: {
                delay: 300
            },
            default_message: "You have recieved an alert.",
            key: "Alert",
            type: 'alert'
        }

        if (alertConfigList.length > 0) {

            if(alertConfigList[0].company.alert_configs){
                var alertConfigsForCompany = alertConfigList[0].company.alert_configs
                if(alertConfigsForCompany.alert_email_delay){
                    alertConfig.email.delay = alertConfigsForCompany.alert_email_delay
                }
                if(alertConfigsForCompany.alert_sms_delay){
                alertConfig.sms.delay = alertConfigsForCompany.alert_sms_delay
                }
                if(alertConfigsForCompany.alert_notification_delay){
                alertConfig.notification.delay = alertConfigsForCompany.alert_notification_delay
                }
                if(alertConfigsForCompany.default_message){
                alertConfig.default_message = alertConfigsForCompany.default_message
                }
            }

            var emailKey = alertType + "_" + deviceId + "_email"
            var smsKey = alertType + "_" + deviceId + "_sms"
            var notificationKey = alertType + "_" + deviceId + "_notification"
            var emailIsDelayed = await getOneFromCache("AlertHistory", emailKey)
            var smsIsDelayed = await getOneFromCache("AlertHistory", smsKey)
            var notificationIsDelayed = await getOneFromCache("AlertHistory", notificationKey)
            if (!emailIsDelayed && alertConfig.email.delay > 0) {
                await setInCache("AlertHistory", emailKey, {}, alertConfig.email.delay)
            }
            if (!smsIsDelayed && alertConfig.sms.delay > 0) {
                await setInCache("AlertHistory", smsKey, {}, alertConfig.sms.delay)
            }
            if (!notificationIsDelayed && alertConfig.notification.delay > 0) {
                await setInCache("AlertHistory", notificationKey, {}, alertConfig.notification.delay)
            }
            alertConfigList.forEach(async (element, index) => {
                const alertConfigForCompany = element.company.alert_configs;
                let companyId = element.company.id;
                let company_code = element.company.code;
                let cognitoId = null
                let email = null
                let phoneNumber = null
                let phoneNumberList = [];
                let notificationTokenLists = []
                let name = null;
                let message = null;
                let phNo = null;
                let language = null;
                let user_name = null;
                let deviceName = null;
                let device_code = null;
                let first_last_name = null;
                let first_name = null;
                let last_name = null;

                deviceName = (element.device && element.device.name) ? element.device.name : null;
                device_code = (element.device && element.device.device_code) ? element.device.device_code : null;

                if (element.user) {
                    cognitoId = element.user.cognito_id
                    email = element.user.email
                    phNo = element.user.phone_number
                    phoneNumberList.push(phNo);
                }
                if (element.occupant) {
                    const occupantId = element.occupant.id;
                    phoneNumberList = await getAllOccupantsMetadata(occupantId).then((result) => {
                        return result;
                    }).catch((err) => {
                        reject(err);
                    });

                    cognitoId = element.occupant.cognito_id
                    email = element.occupant.email
                    phNo = element.occupant.phone_number 
                    if (!phoneNumberList.includes(phNo)) {
                        phoneNumberList.push(phNo);
                    }
                    // now check the email in occupant and assign language.
                    if (element.occupant.language != null) {
                        language = element.occupant.language;
                    } else {
                        language = Entities.default_language.event_name.default;
                    };

                    if (element.occupant.first_name != null) {
                        user_name = element.occupant.first_name;
                        first_last_name = (element.occupant.last_name != null)?`${element.occupant.first_name} ${element.occupant.last_name}`: `${element.occupant.first_name}`;
                        first_name = element.occupant.first_name;
                        last_name = (element.occupant.last_name != null)?element.occupant.last_name : '';
                    } else {
                        user_name = email;
                        first_last_name = email;
                        first_name = email;
                        last_name = '';
                    };
                    const notificationToken = await getUserNotificationTokens(element.occupant.id)
                        .catch((err) => {
                            reject(err);
                        });
                    if (notificationToken && notificationToken.length > 0) {
                        notificationTokenLists = lodash.map(notificationToken, 'token');
                    }
                }
                if (element.alert_message) {
                    message = element.alert_message;
                    let amessage = message
                    deviceName = element.device.name;
                    if (!deviceName) {
                        deviceName = element.device.mac_address;
                        deviceName = deviceName.replace(/:/g, '')
                        deviceName = `[${deviceName}]`
                    }
                    const regex = /DeviceName/i;
                    amessage = amessage.replace(regex, deviceName)
                    message = amessage;

                } else {
                    message = alertConfig.default_message;
                }
                let alertConditionsData = {};
                let lowBatteryTypes = ['ErrorIASZSLowBattery', 'Error32', 'TRVError22', 'ErrorPowerSLowBattery', 'lowBattery'];
               if (alertType && (lowBatteryTypes.includes(alertType) || alertType == 'ErrorLossLinkStatus' || alertType == 'connected')) {
                    alertConditionsData = await getAlertConditions(alertType, language, alertConfig)
                        .then((result) => {
                            return (result);
                        }).catch(err => {
                            reject(err);
                        });
                }
                let alert_key = null;
                if (alertConditionsData && Object.keys(alertConditionsData).length > 0) {
                    alert_key = alertConditionsData.alert_key;
                }
               
                if (!alert_key) {
                    alert_key = alertConfig.key;
                }

                if (alertConfigForCompany.alert_email_enabled == true &&
                    element.email_enabled == true && email && !emailIsDelayed
                ) {
                    var object = {
                        email: email,
                        alert_type: alertType,
                        key: alert_key || alertConfig.key,
                        type: alertConfig.type,
                        name: name || null,
                        message: message,
                        language: language,
                        user_name : user_name,
                        first_last_name: first_last_name,
                        first_name: first_name,
                        last_name: last_name,
                        device_code: element.device.device_code,
                        device_name: element.device.name,
                        gateway_name: element.device.name || element.device.device_code,
                        company_id: companyId,
                        receiverList: [{ email: email }]
                    }
                    if (obj.binding_device_code) {
                        object.binding_device_code = obj.binding_device_code
                    }
                    if (obj.binding_device_name) {
                        object.binding_device_name = obj.binding_device_name
                    }
                        await emailQueueProducer.sendProducer(object)
                }
                if (alertConfigForCompany.alert_sms_enabled == true &&
                    element.sms_enabled == true && phoneNumberList && phoneNumberList.length > 0 && !smsIsDelayed
                ) {
                    var phoneList = []
                    for (let number in phoneNumberList) {
                        phoneNumber = phoneNumberList[number];
                        if (validatePhoneNumber.isPossibleNumberString(phoneNumber)) {
                            let phNo = validatePhoneNumber.parse(phoneNumber)
                            phNo = phNo.values_;
                            phNo = Object.values(phNo);
                            let country_code = '+' + phNo[0];
                            phNo = phNo[1].toString();
                            let country = validatePhoneNumber.getRegionCodeForCountryCode(parseInt(country_code));
                            phoneList.push({
                                phone_number: phNo,
                                country: country,
                            });
                        }
                    }
                    if (phoneList.length > 0) {
                        var object = {
                            phoneNumber: phNo,
                            alert_type: alertType,
                            config_id: element.id,
                            key: alert_key || alertConfig.key,
                            type: alertConfig.type,
                            name: name || null,
                            message: message,
                            language: language,
                            user_name: user_name,
                            first_last_name: first_last_name,
                            first_name: first_name,
                            last_name: last_name,
                            device_code: element.device.device_code,
                            device_name: element.device.name,
                            gateway_name: element.device.name || element.device.device_code,
                            company_id: companyId,
                            phoneNumberList: phoneList
                        }
                        if (obj.binding_device_code) {
                            object.binding_device_code = obj.binding_device_code
                        }
                        if (obj.binding_device_name) {
                            object.binding_device_name = obj.binding_device_name
                        }
                        await smsQueueProducer.sendProducer(object)
                    }
                }

                if (alertConfigForCompany.alert_notification_enabled == true &&
                    element.notification_enabled == true &&
                    notificationTokenLists && notificationTokenLists.length > 0 && !notificationIsDelayed) {
                    let data = {
                        module: 'alert',
                        device_id: element.device.id,    
                        click_action: "FLUTTER_NOTIFICATION_CLICK",
                    }
                    if(element.device.gateway_id){
                        data["gateway_id"]=element.device.gateway_id
                    }
                    var object = {
                        email: email || null,
                        alert_type: alertType,
                        key: alert_key || alertConfig.key,
                        type: alertConfig.type,
                        name: name || null,
                        message: message,
                        language: language,
                        user_name: user_name,
                        first_last_name: first_last_name,
                        first_name: first_name,
                        last_name: last_name,
                        device_code: element.device.device_code,
                        device_name: element.device.name,
                        gateway_name: element.device.name || element.device.device_code,
                        company_id: companyId,
                        notificationTokenList: notificationTokenLists,
                        notificationData: data
                    }
                    
                    if (obj.binding_device_code) {
                        object.binding_device_code = obj.binding_device_code
                    }
                    if (obj.binding_device_name) {
                        object.binding_device_name = obj.binding_device_name
                    }
                     await notificationQueueProducer.sendProducer(object)
                }
                if (alertConfigList.length - 1 == index) {
                    resolve()
                }
            })
        }
    })
}

const alertCommunicationConfig = function (obj) {
    return new Promise(async (resolve, reject) => {
        const alertType = obj.alert_type;
        const deviceId = obj.device_id;
        if (alertType && deviceId) {
            const alertConfigList = await getAlertConfigs(alertType, deviceId).then((result) => {
                return result;
            }).catch((err) => {
                reject(err);
            });
            if (alertConfigList && alertConfigList.length > 0) {
                await manageSendAlert(alertConfigList, alertType, deviceId, obj).catch((err) => {
                    reject(err);
                });
            }
        }
        resolve();
    })
}

module.exports = {
    alertCommunicationConfig, getUserNotificationTokens
}
