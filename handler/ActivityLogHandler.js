const models = require('../models');
let sqsEmailProducer = require('../sqs/EmailQueueProducer')
let sqsSMSProducer = require('../sqs/SMSQueueProducer')
let sqsNotificationProducer = require('../sqs/NotificationQueueProducer')
let Logger = require('../Logger')
const validatePhoneNumber = require('google-libphonenumber').PhoneNumberUtil.getInstance();
const oneTouchCommunicationConfigHandler = require('./OneTouchCommunicationConfig');
const { Entities } = require('../utils/Entities');
const { getCompany } = require('../cache/Companies');

let getActivityLogConfig = function (event_name) {
    return new Promise((resolve, reject) => {
        models.activity_log_communication_configs.findOne({
            where: {
                event_name
            }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err);
        })
    })
}
let addActivityLogConfig = function (event_name, email_enabled, sms_enabled, notification_enabled, placeholders, company_id) {
    return new Promise(async (resolve, reject) => {
        const activityLogConfigObj = await getActivityLogConfig(event_name).catch(err => { reject(err); })
        if (!activityLogConfigObj) {
            models.activity_log_communication_configs.create({
                event_name, email_enabled, sms_enabled, notification_enabled, placeholders, company_id
            }).then(result => {
                resolve(result)
            }).catch(err => {
                reject(err);
            })
        } else {
            resolve(activityLogConfigObj)
        }

    })
}
let addTemplateContent = function (event_name, language, email_config, notification_config, sms_config) {
    return new Promise((resolve, reject) => {
        models.template_contents.create({
            event_name, language, email_config, notification_config, sms_config
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err);
        })
    })
}

let manage = function (obj) {
    return new Promise(async (resolve, reject) => {
        let eventName = obj.event_name;
        let company_id = obj.company_id;
        let data = null;
        let where = null;
        // get company activities_configs and add in condition
        const getCompanyActivityConfigs = await getCompany(company_id).then(result => {
            return (result);
        }).catch(err => {
            reject(err);
        });
        console.log("🚀 ~ manage ~ getCompanyActivityConfigs:", getCompanyActivityConfigs)
        // store company activity configs
        if (getCompanyActivityConfigs) {
            console.log("🚀 ~ manage ~ getCompanyActivityConfigs:", getCompanyActivityConfigs)
            const activityConfigForCompany = getCompanyActivityConfigs.activities_configs;
            const companyEmailConfig = activityConfigForCompany.activity_email_enabled !== undefined ? activityConfigForCompany.activity_email_enabled : true;
            const companySmsConfig = activityConfigForCompany.activity_sms_enabled !== undefined ? activityConfigForCompany.activity_sms_enabled : true;
            const companyNotificationConfig = activityConfigForCompany.activity_notification_enabled !== undefined ? activityConfigForCompany.activity_notification_enabled : true;
            getActivityLogConfig(eventName).then(async activityLogConfigObj => {
                console.log("🚀 ~ manage ~ activityLogConfigObj:", activityLogConfigObj)
                if (activityLogConfigObj) {
                    let emailEnabled = activityLogConfigObj.email_enabled
                    let smsEnabled = activityLogConfigObj.sms_enabled
                    let notificationEnabled = activityLogConfigObj.notification_enabled
                    console.log("🚀 ~ manage ~ emailEnabled:", emailEnabled,companyEmailConfig)
                    if (emailEnabled == true && companyEmailConfig == true) {
                        if (obj.placeholders_data) {
                            console.log("🚀 ~ manage ~ obj.placeholders_data:", obj.placeholders_data)
                            if (obj.placeholders_data.receiverList && obj.placeholders_data.receiverList.length > 0) {
                                const receiverList = obj.placeholders_data.receiverList;
                                console.log("🚀 ~ manage ~ receiverList:", receiverList)
                                for (let key in receiverList) {
                                    const receiver = receiverList[key]
                                    console.log("🚀 ~ manage ~ receiver:", receiver)
                                    if (receiver.email) {
                                        const email = receiver.email
                                        where = { email: email }
                                        const getOccupants = await oneTouchCommunicationConfigHandler.getOccupants(where, obj.placeholders_data.language, obj.placeholders_data.first_last_name, obj.placeholders_data.first_name, obj.placeholders_data.last_name).then(result => {
                                            return (result);
                                        }).catch((err) => {
                                            reject(err);
                                        });
                                        console.log("🚀 ~ manage ~ getOccupants:", getOccupants)
                                        if (obj.data && obj.data != null) {
                                            obj.data.key = obj.event_name
                                            obj.data.type = "activity"
                                            obj.placeholders_data.receiverList = [where]
                                            data = Object.assign(obj.data, obj.placeholders_data);
                                            data.language = getOccupants.language;
                                            data.user_name = getOccupants.user_name;
                                            data.first_last_name = getOccupants.first_last_name;
                                            data.first_name = getOccupants.first_name;
                                            data.last_name = getOccupants.last_name;
                                            data.company_id = company_id;
                                            console.log("🚀 ~ manage ~ data:", data)
                                            // send obj to EmailQueue
                                            await sqsEmailProducer.sendProducer(data)
                                            resolve()
                                        }
                                    }
                                }
                            }
                        }

                        else if (obj.event_name == 'OccupantPermissionAdded' && obj.placeholders_data == null) {
                            resolve();
                        }
                        else {
                            Logger.error("activityLogError", { "msg": "placeholder_data is not given", obj });
                            resolve();
                        }
                    }

                    /* phoneNumberList must include list of object containing country and phone_number like 
                       phoneNumberList:[ 
                        {phone_number: +91XXXXXXXX, country: 'in'},
                        {phone_number: +91XXXXXXXX,country: 'in'}
                    ]*/
                    if (smsEnabled == true && companySmsConfig == true) {
                        if (obj.placeholders_data) {
                            if ((obj.placeholders_data.phoneNumberList)) {
                                if (obj.placeholders_data.phoneNumberList.length > 0) {
                                    const phoneNumberList = obj.placeholders_data.phoneNumberList;
                                    for (let key in phoneNumberList) {
                                        const receiver = phoneNumberList[key]
                                        if (receiver.phone_number && receiver.country) {
                                            let country_code = validatePhoneNumber.getCountryCodeForRegion(receiver.country);
                                            const phone_number = '+' + country_code + receiver.phone_number
                                            where = { phone_number: phone_number }
                                            if (where) {
                                                const getOccupants = await oneTouchCommunicationConfigHandler.getOccupants(where, obj.placeholders_data.language, obj.placeholders_data.first_last_name, obj.placeholders_data.first_name, obj.placeholders_data.last_name).then(result => {
                                                    return (result);
                                                }).catch((err) => {
                                                    reject(err);
                                                });
                                                if (obj.data && obj.data != null) {
                                                    obj.data.key = obj.event_name
                                                    obj.data.type = "activity"
                                                    obj.placeholders_data.phoneNumberList = [{
                                                        phone_number: receiver.phone_number,
                                                        country: receiver.country
                                                    }]
                                                    data = Object.assign(obj.data, obj.placeholders_data);
                                                    data.language = getOccupants.language;
                                                    data.user_name = getOccupants.user_name;
                                                    data.first_last_name = getOccupants.first_last_name;
                                                    data.first_name = getOccupants.first_name;
                                                    data.last_name = getOccupants.last_name;
                                                    data.company_id = company_id;
                                                    // send obj to SMSQueue
                                                    await sqsSMSProducer.sendProducer(data)
                                                    resolve()

                                                }
                                            }
                                        }
                                    }

                                }
                            }
                        }
                        else if (obj.event_name == 'OccupantPermissionAdded' && obj.placeholders_data == null) {
                            resolve();
                        }
                        else {
                            Logger.error("activityLogError", { "msg": "placeholder_data is not given", obj });
                            resolve();
                        }
                    }
                    if (notificationEnabled == true && companyNotificationConfig == true) {
                        if (obj.placeholders_data) {
                            if ((obj.placeholders_data.notificationTokenList)) {
                                if (obj.placeholders_data.notificationTokenList.length > 0) {
                                    const notificationTokenList = obj.placeholders_data.notificationTokenList;
                                    for (let key in notificationTokenList) {
                                        const Token = notificationTokenList[key]
                                        // if (receiver.Token) {
                                        const getTokenData = await models.occupants_notification_tokens.findOne({
                                            where: {
                                                token: Token
                                            }
                                        }).then(result => {
                                            return result;
                                        }).catch((err) => {
                                            reject(err);
                                        });
                                        if (getTokenData) {
                                            where = { id: getTokenData.occupant_id, }
                                            const getOccupants = await oneTouchCommunicationConfigHandler.getOccupants(where, obj.placeholders_data.language, obj.placeholders_data.first_last_name, obj.placeholders_data.first_name, obj.placeholders_data.last_name).then(result => {
                                                return (result);
                                            }).catch((err) => {
                                                reject(err);
                                            });
                                            if (obj.data && obj.data != null) {
                                                obj.data.key = obj.event_name
                                                obj.data.type = "activity"
                                                obj.placeholders_data.notificationTokenList = [Token]
                                                data = Object.assign(obj.data, obj.placeholders_data);
                                                data.language = getOccupants.language;
                                                data.user_name = getOccupants.user_name;
                                                data.first_last_name = getOccupants.first_last_name;
                                                data.first_name = getOccupants.first_name;
                                                data.last_name = getOccupants.last_name;
                                                data.company_id = company_id;
                                                await sqsNotificationProducer.sendProducer(data)
                                                resolve()

                                            }
                                        }
                                        else {
                                            Logger.error("activityLogError", { "msg": "Token is not found in occupants_notification_tokens table", obj, Token });
                                            resolve();
                                        }
                                        // }
                                    }
                                }
                            }
                        }
                        else if (obj.event_name == 'OccupantPermissionAdded' && obj.placeholders_data == null) {
                            resolve();
                        }
                        else {
                            Logger.error("activityLogError", { "msg": "placeholder_data is not given", obj });
                            resolve();
                        }
                    }
                    resolve()
                }
                else {
                    addActivityLogConfig(eventName, false, false, false, null, company_id).then(result => {
                        resolve()
                    }).catch(err => {
                        reject(err)
                    })
                }
            }).catch(err => {
                reject(err)
            })
        }
        else {
            Logger.info("Info-Error", { "message": "company_id/code is wrong, company not found in postgres db.", value: company_id });
         
        }

    })
}
module.exports = {
    manage
}