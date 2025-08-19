const models = require('../models');
const mustache = require('mustache');
const Logger = require('../Logger');
const validatePhoneNumber = require('google-libphonenumber').PhoneNumberUtil.getInstance();
const PNF = require('google-libphonenumber').PhoneNumberFormat;
let { deleteActivityLogs, deleteMultipleActivityLogs, addActivityLog } = require('../services/ActivityLogService')
var AWS = require("aws-sdk");
const { Entities } = require('../utils/Entities');
const { getCompany } = require('../cache/Companies');
const { getOneFromCache, setDataWithDateCacheKey, getIncreament } = require('../cache/Cache');
const moment = require('moment');
const { DataTypes } = require('sequelize');

AWS.config.update({
    region: process.env.SMS_AWS_REGION,
    accessKeyId: process.env.SMS_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.SMS_AWS_SECRET_ACCESS_KEY
});
var SNS = new AWS.SNS({ apiversion: process.env.API_VERSION });

const getBasicTemplate = async function (body, data_parameter, companyCreds) {

    const companyName = companyCreds.name
    const companyCode = companyCreds.code
    var companyAddress = companyCreds.address
    const combineAddress = companyAddress.line_1 + " " + companyAddress.line_2 + " " + companyAddress.line_3 + " " +
        companyAddress.city + ", " + companyAddress.state + ", " + companyAddress.zip_code + ", " + companyAddress.country
    var default_parameter = {
        company_name: companyName,
        company_code: companyCode,
        company_address: combineAddress,
        company_link: "https://" + companyCode + ".staging-console.ctiotsolution.com",
        body
    }
    const template_parameter = Object.assign({}, default_parameter, data_parameter)
    body = mustache.render(body, template_parameter);
    return { body }
}
const getTemplateContent = function (key, type, language) {
    return new Promise(async (resolve, reject) => {
        const data = await models.template_contents.findOne({
            where: {
                key, type, language
            }
        }).then(result => {
            return (result);
        }).catch(err => {
            reject(err);
        });

        if (data && Object.keys(data).length > 0) {
            resolve(data);
        } else {
            const dataDefault = await models.template_contents.findOne({
                where: {
                    key, type, language: Entities.default_language.event_name.default
                }
            }).then(result => {
                return (result);
            }).catch(err => {
                reject(err);
            });
            resolve(dataDefault);
        }
    })
}
const sendSMS = function (body, PhoneNumber) {
    return new Promise(async (resolve, reject) => {
        const params = {
            Message: body,
            PhoneNumber: PhoneNumber,
        };
        const publishTextPromise = SNS.publish(params).promise();
        publishTextPromise.then((data) => {
            resolve(data.MessageId);
        }).catch((err) => {
            reject(err);
        });
    })
}
const AddDataToSmsHandler = function (smsData) {
    return new Promise(async (resolve, reject) => {
        let data = await models.sms_handler.create({
            phone_number: smsData.phone_number,
            message: smsData.message,
            module: smsData.module,
            company_id: smsData.company_id
        }).then(result => {
            return (result);
        }).catch(err => {
            reject(err);
        });
        resolve(data);
    })
}
const manageTemplateContent = function (obj, key, type, language, companyCreds) {
    return new Promise(async (resolve, reject) => {
        await getTemplateContent(key, type, language).then(async (templateContentObj) => {
            if (templateContentObj) {
                var body = templateContentObj.sms_config.body
                var data = obj
                var phoneNumberList = data.phoneNumberList || [];
                var template = await getBasicTemplate(body, data, companyCreds)
                if (template) {
                    phoneNumberList.forEach(async receiver => {
                        const isValidNumber = validatePhoneNumber.parseAndKeepRawInput(receiver.phone_number, receiver.country);
                        var PhoneNumber = validatePhoneNumber.format(isValidNumber, PNF.INTERNATIONAL);
                        if (validatePhoneNumber.isValidNumber(isValidNumber) === true) {
                            // console.log("🚀 ~ awaitgetTemplateContent ~ companyCreds:", companyCreds)

                            if ((companyCreds?.configs?.use_automation_instead_of_one_touch_in_sms == true) && type == 'onetouch') {
                                type = "automation";
                            }
                            let smsData = {
                                phone_number: PhoneNumber,
                                message: template.body,
                                module: type,
                                company_id: companyCreds.id
                            }
                            console.log("🚀 ~ file: SMSHandler.js:111 ~ smsData:", smsData)
                            let handlerData = await AddDataToSmsHandler(smsData).catch(err => {
                                console.log("caught error line - 134:", err);
                                reject(err);
                            });
                            // sendSMS(template.body, PhoneNumber).then(result => {
                            //     try {
                            //         addActivityLog(Entities.SMS.entity_name, Entities.SMS.event_name.sent, { PhoneNumber, data, key: key }, "SMS sent", companyCreds.id, companyCreds.id)
                            //     } catch (error) {
                            //         addActivityLog(Entities.SMS.entity_name, Entities.SMS.event_name.error, { error }, "SMS error", companyCreds.id, companyCreds.id)
                            //         Logger.error("Error", { "msg": error.message })
                            //         reject(error);
                            //     }

                            // }).catch(err => {
                            //     addActivityLog(Entities.SMS.entity_name, Entities.SMS.event_name.error, { err }, "SMS error", companyCreds.id, companyCreds.id)
                            //     if (err && err.message) {
                            //         Logger.error("Error", { "stack": err.stack, "msg": err.message })
                            //     }
                            //     reject(err);
                            // })
                        }
                        else {
                            addActivityLog(Entities.SMS.entity_name, Entities.SMS.event_name.error, { PhoneNumber }, "phone number is not valid", companyCreds.id, companyCreds.id)
                        }
                    });
                }
                resolve()
            } else {
                resolve()
                Logger.info("Info-Error", { "message": "No template content found for alert." + key, value: companyCreds.code })
            }
        }).catch(err => {
            reject(err)
        })
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


const manage = function (obj) {
    return new Promise(async (resolve, reject) => {
        try {
            let companyId = null;
            let companyCreds = null;
            let company = null;
            if (obj && obj.company_id) {
                // console.log("🚀 ~ SMSHandler treturnnewPromise ~ obj:", obj)
                // call a function which will find company data from cache if not present it will set new data in cache and returns the company data.
                company = await getCompany(obj.company_id).then(result => {
                    return (result);
                }).catch(err => {
                    console.log("caught error line - 134:", err);
                    reject(err);
                });

                if (!company || !company.id) {
                    Logger.info("Info-Error", { "message": "company_id is wrong, not found company_id to postgres db.", value: obj.company_id })
                    reject()
                }
                if (!companyId) {
                    companyId = company.id
                    companyCreds = company
                }
                var key = obj.key //for template key
                var type = obj.type  // for template type          
                var language = obj.language  // for template language
                if (key && type && language) {
                    if (key == 'OneTouch') {
                        const cacheKey = 'onetouchdDailyCount';
                        const dateOnetouchId = `${moment().startOf('day').format('YYYY-MM-DD')}-${obj.one_touch_rule_id}`;
                        const expiryInSeconds = await getExpiryTimeUntilEndOfCurrentDay();
                        let data = await getOneFromCache(cacheKey, dateOnetouchId)
                        if (data != null) {
                            let msgCount = await getIncreament(dateOnetouchId);
                            if (company.alert_configs.one_touch_sms_daily_limit && msgCount == company.alert_configs.one_touch_sms_daily_limit + 1) {
                                let SMSObj = {
                                    "action_trigger_key": obj.action_trigger_key,
                                    "one_touch_rule_id": obj.one_touch_rule_id,
                                    "key": "OneTouchSMSExceeded",
                                    "type": type,
                                    "language": obj.language,
                                    "user_name": obj.user_name,
                                    "first_last_name": obj.first_last_name,
                                    "first_name": obj.first_name,
                                    "last_name": obj.last_name,
                                    "phoneNumberList": obj.phoneNumberList
                                }
                                manageTemplateContent(SMSObj, "OneTouchSMSExceeded", type, language, companyCreds, companyId).then(async () => {
                                    addActivityLog(Entities.SMS.entity_name, Entities.SMS.event_name.exceeded, { obj }, "SMS exceeded", companyId, companyId)
                                    resolve();
                                }).catch(err => {
                                    reject(err)
                                })
                            } else if (company.alert_configs.alert_sms_daily_limit && msgCount <= company.alert_configs.one_touch_sms_daily_limit) {
                                manageTemplateContent(obj, key, type, language, companyCreds, companyId).then(async () => {
                                    resolve()
                                }).catch(err => {
                                    reject(err)
                                })
                            } else {
                                resolve();
                            }
                        }
                        if (!data) {
                            setDataWithDateCacheKey(cacheKey, dateOnetouchId, { value: obj.one_touch_rule_id }, expiryInSeconds);
                            manageTemplateContent(obj, key, type, language, companyCreds, companyId).then(async () => {
                                resolve()
                            }).catch(err => {
                                reject(err)
                            })
                        }
                        resolve();
                    } else if (key == 'Alert') {
                        const cacheKey = 'alertDailyCount';
                        const dateAlertId = `${moment().startOf('day').format('YYYY-MM-DD')}-${obj.config_id}`;
                        const expiryInSeconds = await getExpiryTimeUntilEndOfCurrentDay();
                        let data = await getOneFromCache(cacheKey, dateAlertId)
                        if (data != null) {
                            let msgCount = await getIncreament(dateAlertId);
                            if (company.alert_configs.alert_sms_daily_limit && msgCount == company.alert_configs.alert_sms_daily_limit + 1) {
                                let SMSObj = {
                                    "config_id": obj.config_id,
                                    "key": "AlertSMSExceeded",
                                    "type": type,
                                    "language": obj.language,
                                    "user_name": obj.user_name,
                                    "first_last_name": obj.first_last_name,
                                    "first_name": obj.first_name,
                                    "last_name": obj.last_name,
                                    "phoneNumberList": obj.phoneNumberList
                                }
                                manageTemplateContent(SMSObj, "AlertSMSExceeded", type, language, companyCreds, companyId).then(async () => {
                                    addActivityLog(Entities.SMS.entity_name, Entities.SMS.event_name.exceeded, { obj }, "SMS exceeded", companyId, companyId)
                                    resolve();
                                }).catch(err => {
                                    reject(err)
                                })
                            } else if (company.alert_configs.alert_sms_daily_limit && msgCount <= company.alert_configs.alert_sms_daily_limit) {
                                manageTemplateContent(obj, key, type, language, companyCreds, companyId).then(async () => {
                                    resolve()
                                }).catch(err => {
                                    reject(err)
                                })
                            } else {
                                resolve();
                            }
                        }
                        if (!data) {
                            await setDataWithDateCacheKey(cacheKey, dateAlertId, { value: obj.config_id }, expiryInSeconds);
                            manageTemplateContent(obj, key, type, language, companyCreds, companyId).then(async () => {
                                resolve()
                            }).catch(err => {
                                reject(err)
                            })
                        }
                        resolve();
                    } else {
                        manageTemplateContent(obj, key, type, language, companyCreds, companyId).then(async () => {
                            resolve()
                        }).catch(err => {
                            reject(err)
                        })
                    }
                } else {
                    Logger.info("Info-Error", { "message": "key and type is missing. " + JSON.stringify(obj), value: obj.company_id })
                    resolve()
                }
            } else {
                Logger.info("Info-Error", { "message": "company_id is missing." + JSON.stringify(obj) })
                resolve()
            }
        } catch (error) {
            reject(error)
        }
    })
}

module.exports = {
    manage
}