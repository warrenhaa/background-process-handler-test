const models = require('../models');
const mustache = require('mustache');
const Logger = require('../Logger');
const sequelize = require('sequelize');
var admin = require("firebase-admin");
var serviceAccount = require("../serviceAccountKey.json");
const { Op } = models.Sequelize;
let { deleteActivityLogs, deleteMultipleActivityLogs, addActivityLog } = require('../services/ActivityLogService')
const { Entities } = require('../utils/Entities');
const { getCompany } = require('../cache/Companies');

admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.SERVICE_ACCOUNT_KEY))
});
const getBasicTemplate = async function (body, data_parameter, title, companyCreds) {

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
    title = mustache.render(title, template_parameter);
    return { body, title }
}
const getTemplateContent = function (key, type, language) {
    return new Promise(async (resolve, reject) => {
        let search = key;
        const data = await models.template_contents.findOne({
            where: {
                key: {
                    [Op.iLike]: '%' + search + '%'
                }, type,
                language
            }
        }).catch((error) => {
            reject(error);
        });
        if (data && Object.keys(data).length > 0) {
            if ((data.key).toLowerCase() == key.toLowerCase()) {
                resolve(data)
            }
            else {
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

const deleteNotificationToken = function (tokensList, companyCreds) {
    return new Promise(async (resolve, reject) => {
        await models.occupants_notification_tokens.destroy({
            where: {
               token:  {
                    [Op.in]: tokensList,
                },
            }
        }).catch((err) => {
            reject(err)
        });
        addActivityLog(Entities.occupants_notification_tokens.entity_name, Entities.occupants_notification_tokens.event_name.deleted, { tokensList }, "Expired notification tokens successfully deleted", companyCreds.id, companyCreds.id)

    })
}

const sendNotification = function (body, title, Tokens_array, data, companyCreds) {
    return new Promise(async (resolve, reject) => {
        let errorList = []
        const registrationTokens = Tokens_array;
        let message = {};

        if (data.notificationData && data.notificationData.notification_type && data.notificationData.notification_type == 'intreactive_notification') {
            message = {
                tokens: registrationTokens,
                notification: {title: title, body: body},
                data: {
                    notification: JSON.stringify({title: title, body: body}),
                    ...data.notificationData
                },
                android: {
                    "priority":"high"
                },
                apns:{
                    "headers":{
                        "apns-priority":"10"
                    },
                    "payload": {
                        "aps": {
                            "content-available": 1
                        }
                    }
                },
                webpush: {
                    "headers": {
                        "Urgency": "high"
                    }
                }
            };
        } else {
            message = {
                notification: {title: title, body: body},
                tokens: registrationTokens,
                data: data.notificationData || {},
                android: {
                    "priority":"high"
                },
                apns:{
                    "headers":{
                        "apns-priority":"10"
                    },
                    "payload": {
                        "aps": {
                            "content-available": 1
                        }
                    }
                },
                webpush: {
                    "headers": {
                        "Urgency": "high"
                    }
                }
            };
        }

        console.log("🚀 ~ file: NotificationHandler.js:96 ~ message:", message)
        admin.messaging().sendEachForMulticast(message)
            .then((response) => {
                response.responses.forEach((res, index) => {
                    const token = registrationTokens[index];
                    if (res.error) {
                        const errorCode = res.error.code;
                        if (errorCode === 'messaging/invalid-registration-token' || errorCode === 'messaging/registration-token-not-registered' ||
                            errorCode === 'messaging/invalid-argument') {
                            errorList.push(token)
                            // console.log(`Token ${token} is invalid or expired.`);
                        }
                        addActivityLog(Entities.notification.entity_name, Entities.notification.event_name.error, {
                            errorCode,
                            data
                        }, "Notification error", companyCreds.id, companyCreds.id)

                    }
                });

                console.log("🚀 ~ file: NotificationHandler.js:111", errorList)
                deleteNotificationToken(errorList, companyCreds).catch((error) => {
                    reject(error);
                });

                resolve(response);
            })
            .catch((error) => {
                reject(error);
            });

    })
}
const manageTemplateContent = function (obj, key, type, language, companyCreds) {
    return new Promise(async (resolve, reject) => {
        await getTemplateContent(key, type, language).then(async (templateContentObj) => {
            if (templateContentObj && templateContentObj.notification_config) {
                var tokensList = [];
                var body = templateContentObj.notification_config.body
                var title = templateContentObj.notification_config.title
                var data = obj
                var notificationTokenList = data.notificationTokenList || [];
                // console.log("🚀 ~ file: NotificationHandler.js:135 ~ notificationTokenList:", notificationTokenList)
                notificationTokenList.forEach(async receiver => {
                    if (receiver !== "DummyTockenFromWebapp") {
                        tokensList.push(receiver);
                    }
                });
                var template = await getBasicTemplate(body, data, title, companyCreds)
                // console.log("🚀 ~ file: NotificationHandler.js:139 ~ template:", template)
                // console.log("🚀 ~ file: NotificationHandler.js:166 ~ notificationTokenList:", notificationTokenList)
                if (template && tokensList && tokensList.length > 0) {
                    sendNotification(template.body, template.title, tokensList, data, companyCreds).then(result => {
                        try {
                            addActivityLog(Entities.notification.entity_name, Entities.notification.event_name.sent, { tokensList, data, key: key }, "Notification sent", companyCreds.id, companyCreds.id)
                        } catch (error) {
                            addActivityLog(Entities.notification.entity_name, Entities.notification.event_name.error, { error, data, key: key }, "Notification error", companyCreds.id, companyCreds.id)
                            Logger.error("Error", { "msg": error.message })
                            reject(error);
                        }
                    }).catch(err => {
                        addActivityLog(Entities.notification.entity_name, Entities.notification.event_name.error, { err, data, key: key }, "Notification error", companyCreds.id, companyCreds.id)
                        if (err && err.message) {
                            Logger.error("Error", { "stack": err.stack, "msg": err.message })
                        }
                        reject(err);
                    })
                }
                resolve()
            }
            else {
                resolve()
                Logger.info("Info-Error", { "message": "No template content found for alert." + key, value: companyCreds.code })
            }
        }).catch(err => {
            reject(err)
        })
    })
}
const manage = function (obj) {
    console.log("🚀 ~ file: NotificationHandler.js:170 ~ obj:", obj)
    return new Promise(async (resolve, reject) => {
        try {
            let companyId = null;
            let companyCreds = null;
            let company = null;
            if (obj && obj.company_id) {
                // call a function which will find company data from cache if not present it will set new data in cache and returns the company data.
                company = await getCompany(obj.company_id).then(result => {
                    return (result);
                }).catch(err => {
                    console.log("caught error line - 177:", err);
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
                var language = obj.language // for template language
                if (key && type && language) {
                    manageTemplateContent(obj, key, type, language, companyCreds, companyId).then(async () => {
                        resolve()
                    }).catch(err => {
                        reject(err)
                    })
                } else {
                    Logger.info("Info-Error", { "message": "key and type is missing." + JSON.stringify(obj), value: obj.company_id })
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
