const models = require('../models');
const emailQueueProducer = require('../sqs/EmailQueueProducer')
const smsQueueProducer = require('../sqs/SMSQueueProducer')
const notificationQueueProducer = require('../sqs/NotificationQueueProducer')
const Logger = require('../Logger');
const { getCompany } = require('../cache/Companies');
const validatePhoneNumber = require('google-libphonenumber').PhoneNumberUtil.getInstance();
const { Entities } = require('../utils/Entities');
const alertCommunicationHandler = require('./AlertCommunicationHandler')
const lodash = require('lodash');

const getOneTouchCommunicationConfig = function (action_trigger_key) {
    return new Promise((resolve, reject) => {
        models.one_touch_communication_configs.findOne({
            where: { action_trigger_key }
        }).then(result => {
            resolve(result)
        }).catch((err) => {
            reject(err);
        });
    })
}

const findOneTouchRuleData = function (oneTouchRuleId) {
    return new Promise((resolve, reject) => {
        models.one_touch_rules.findOne({
            where: { id: oneTouchRuleId }
        }).then(result => {
            resolve(result)
        }).catch((err) => {
            reject(err);
        });
    })
}

const getDeviceData = function (device_code) {
    return new Promise((resolve, reject) => {
        models.devices.findOne({
            where: { device_code }
        }).then(result => {
            resolve(result)
        }).catch((err) => {
            reject(err);
        });
    })
}

var getOccupants = function (where, lang, deleteOccFirstLastName, deleteOccFirstName, deleteOccLastName) {
    return new Promise(async (resolve, reject) => {
        let language = null;
        let user_name = null;
        let first_last_name = null;
        let first_name = null;
        let last_name = null;
        let id = null;
        let occupantsData = await models.occupants.findOne({
            where
        }).then(result => {
            return result;
        }).catch((err) => {
            reject(err);
        });
        ///// assigning new language_enabled variable from placeholders_data
        if (occupantsData && occupantsData.language != null) {
            language = occupantsData.language;
        } else {
            language = (lang && lang != null) ? lang : Entities.default_language.event_name.default;
        };
        if (occupantsData) {
            id = occupantsData.id
            if (occupantsData.first_name != null) {
                user_name = occupantsData.first_name;
                first_last_name = (occupantsData.last_name != null) ? `${occupantsData.first_name} ${occupantsData.last_name}` : `${occupantsData.first_name}`;
                first_name = occupantsData.first_name;
                last_name = (occupantsData.last_name != null) ? occupantsData.last_name : '';
            }
            else {
                user_name = occupantsData.email;
                first_last_name = occupantsData.email;
                first_name = occupantsData.email;
                last_name = '';
            }
        } else {
            // user_name = where.email || '';
            // special case for occupant delete as record will get deleted before reaching here, so variables are sent from args list.
            if (deleteOccFirstLastName && deleteOccFirstLastName != null) {
                first_last_name = deleteOccFirstLastName;
            } else {
                first_last_name = where.email || '';
            }

            if (deleteOccFirstName && deleteOccFirstName != null) {
                user_name = deleteOccFirstName;
                first_name = deleteOccFirstName;
                last_name = (deleteOccLastName && deleteOccLastName != null) ? deleteOccLastName : '';
            } else {
                user_name = where.email || '';
                first_name = where.email || '';
                last_name = '';
            }
        };
        resolve({ id,language, user_name, first_last_name, first_name, last_name });
    })
}

const manageSend = function (oneTouchCommunicationConfigData, gateway_id, gateway_code, name, oneTouchRuleId) {
    return new Promise(async (resolve, reject) => {
        console.log("🚀 ~ manageSend ~ oneTouchCommunicationConfigData:", oneTouchCommunicationConfigData)
        let action_trigger_key = oneTouchCommunicationConfigData.action_trigger_key;
        let key = "OneTouch";
        let message = oneTouchCommunicationConfigData.message;
        let emailsArray = oneTouchCommunicationConfigData.emails;
        let phoneNumbersArray = oneTouchCommunicationConfigData.phone_numbers;
        let notificationEmailArray = oneTouchCommunicationConfigData.notification_emails;
        let companyId = oneTouchCommunicationConfigData.company_id;
        let notificationTokenLists = []
        let company = await getCompany(companyId).then(result => {
            return (result);
        }).catch(err => {
            console.log("caught error line - 134:", err);
            reject(err);
        });
        let where = {};
        const alertConfigForCompany = company.alert_configs;
        // let email = [];
        // let phoneNumber = [];

        // for (i = 0; i < emailsArray.length; i++) {
        //     let element = { email: emailsArray[i] };
        //     email.push(element);
        // }
        // for (i = 0; i < phoneNumbersArray.length; i++) {
        //     let element = { phoneNumber: phoneNumbersArray[i] };
        //     phoneNumber.push(element);
        // }
        if (emailsArray && emailsArray.length > 0) {
            for (const attr in emailsArray) {
                const element = emailsArray[attr]; // individual email
                const email = element;
                where = {
                    email: email,
                }
                // now search the email in occupant and get the data need here the language.
                const chooseLanguage = await getOccupants(where).then(result => {
                    return (result);
                }).catch((err) => {
                    reject(err);
                });

                var object = {
                    action_trigger_key: action_trigger_key,
                    one_touch_rule_id: oneTouchRuleId,
                    key: key,
                    name: name,
                    type: "onetouch",
                    message: message,
                    language: chooseLanguage.language,
                    user_name: chooseLanguage.user_name,
                    first_last_name: chooseLanguage.first_last_name,
                    first_name: chooseLanguage.first_name,
                    last_name: chooseLanguage.last_name,
                    gateway_id: gateway_id,
                    gateway_code: gateway_code,
                    company_id: companyId,
                    receiverList: [{ email: email }]
                }
                await emailQueueProducer.sendProducer(object);
            }
        }

        if (phoneNumbersArray && phoneNumbersArray.length > 0) {
            let incorrectPhoneNumberList = []
            for (const attr in phoneNumbersArray) {
                const element = phoneNumbersArray[attr]; // individual email
                const phone_number = element;
                where = {
                    phone_number: phone_number,
                }

                //check 
                // now search the email in occupant and get the data need here the language.
                const chooseLanguage = await getOccupants(where).then(result => {
                    return (result);
                }).catch((err) => {
                    reject(err);
                });

                //redirect sms to notification
                let filterCountriesOccupants = []
                if(alertConfigForCompany.redirect_sms_to_notification  == true || alertConfigForCompany.redirect_sms_to_notification  == 'true'){
                    let filterCountries = []
                    let permissionOccupants = []
                    
                    if(alertConfigForCompany.redirect_sms_for_countries){
                        filterCountries = alertConfigForCompany.redirect_sms_for_countries ||[]
                    }
                    
                    //find all occupants associate with phone numbers ? 
                    //check how many have gateway access ? if none , simply note down and check for countries else select for country check 
                    //check how many in selected countries ? none then normal sms else and send notification by fetching tokens

                    let occupantsData = await models.occupants.findAll({
                        where:{
                            phone_number: phone_number
                        }
                    }).then(result => {
                        return result;
                    }).catch((err) => {
                        reject(err);
                    });
                   
                    if(occupantsData && occupantsData.length>0){
                        let gatewayPermissions = await models.occupants_permissions.findAll({
                            where:{
                                gateway_id
                            }
                        }).then(result => {
                            return result;
                        }).catch((err) => {
                            reject(err);
                        });

                        
                        // filter permission occupants 
                        if(gatewayPermissions && gatewayPermissions.length>0){
                            const gatewayPermissionOccupantIds = lodash.map(gatewayPermissions, 'receiver_occupant_id');

                            //any associated occupants 
                            if(gatewayPermissionOccupantIds && gatewayPermissionOccupantIds.length>0){
                                 permissionOccupants = occupantsData.filter(element=>gatewayPermissionOccupantIds.includes(element.id))
                            }
                           
                        }

                        //any associated with phone number
                        if(permissionOccupants && permissionOccupants.length >0){
                            //associted with phone number
                            
                                if(alertConfigForCompany.redirect_sms_for_all_countries  == true || alertConfigForCompany.redirect_sms_for_all_countries  == 'true'){
                                    filterCountriesOccupants = permissionOccupants
                                }else{
                                    if(filterCountries && filterCountries.length >0){
                                        filterCountriesOccupants = permissionOccupants.filter(element=>filterCountries.includes(element.country))
                                    }else{
                                        // send sms
                                    }
                                }
                            
                        }else{
                            //not associted with gateway permissions
                            if(alertConfigForCompany.redirect_sms_for_all_countries  == true || alertConfigForCompany.redirect_sms_for_all_countries  == 'true'){
                                filterCountriesOccupants = occupantsData
                            }else{
                                if(filterCountries && filterCountries.length >0){
                                        filterCountriesOccupants = occupantsData.filter(element=>filterCountries.includes(element.country))
                                }else{
                                    //send sms
                                }
                            }
  
                        }

                        if(filterCountriesOccupants && filterCountriesOccupants.length>0){
                            //send notification
                            for (let index = 0; index < filterCountriesOccupants.length; index++) {
                                const occupantDetail = filterCountriesOccupants[index];
                                console.log("occupantDetail",occupantDetail)
                                let where = {
                                    email : occupantDetail.email
                                }
                                const occupant = await getOccupants(where).then(result => {
                                    return (result);
                                }).catch((err) => {
                                    reject(err);
                                });
                                console.log("🚀 ~ occupant ~ occupant:", occupant)
                
                                if(occupant){
                                const notificationToken = await alertCommunicationHandler.getUserNotificationTokens(occupant.id)
                                                    .catch((err) => {
                                                        reject(err);
                                                    });
                                 console.log("🚀 ~ returnnewPromise ~ notificationToken:", notificationToken)
                                                        
                                if (notificationToken && notificationToken.length > 0) {
                                    notificationTokenLists = lodash.map(notificationToken, 'token');
                                    }
                                console.log("🚀 ~ returnnewPromise ~ notificationTokenLists:", notificationTokenLists)
                
                                let data = {
                                    module: 'onetouch',
                                    device_id: gateway_id,    
                                    click_action: "FLUTTER_NOTIFICATION_CLICK",
                                }
                                var object = {
                                    action_trigger_key: action_trigger_key,
                                    one_touch_rule_id: oneTouchRuleId,
                                    key: key,
                                    type: 'onetouch',
                                    name: name || null,
                                    message: message,
                                    language: occupant.language,
                                    user_name: occupant.user_name,
                                    first_last_name: occupant.first_last_name,
                                    first_name: occupant.first_name,
                                    last_name: occupant.last_name,
                                    company_id: companyId,
                                    gateway_id: gateway_id,
                                    company_id: companyId,
                                    notificationTokenList: notificationTokenLists,
                                    notificationData: data
                                }
                                console.log("🚀 ~ returnnewPromise ~ notification object:", object)
                                await notificationQueueProducer.sendProducer(object)
                                
                            }
                        }

                        }else{
                            //send sms
                        }
                        
                    
                    }

                }else{
                    console.log("REDIRECT_SMS_TO_NOTIFICATION false")
                }

                if(filterCountriesOccupants.length <1){
                    if (phone_number.startsWith('+')) {
                        let phoneNumber = [];
                        if (validatePhoneNumber.isPossibleNumberString(phone_number)) {
                            let phNo = validatePhoneNumber.parse(phone_number);
                            phNo = phNo.values_;
                            phNo = Object.values(phNo);
                            let country_code = '+' + phNo[0]
                            phNo = phNo[1].toString();
                            let country = validatePhoneNumber.getRegionCodeForCountryCode(parseInt(country_code));
                            phoneNumber.push({
                                phone_number: phNo,
                                country: country,
                            })
                        }
                        if (phoneNumber.length > 0) {
                            let type = "onetouch"
                            var object = {
                                action_trigger_key: action_trigger_key,
                                one_touch_rule_id: oneTouchRuleId,
                                key: key,
                                name: name,
                                type: type,
                                message: message,
                                language: chooseLanguage.language,
                                user_name: chooseLanguage.user_name,
                                first_last_name: chooseLanguage.first_last_name,
                                first_name: chooseLanguage.first_name,
                                last_name: chooseLanguage.last_name,
                                gateway_id: gateway_id,
                                gateway_code: gateway_code,
                                company_id: companyId,
                                phoneNumberList: phoneNumber
                            }
                            console.log("🚀 ~ returnnewPromise ~ phone_number object:", object)
                            await smsQueueProducer.sendProducer(object);
                        }
                        else {
                            // Logger.error("CommunicationConfigError", { "message": "phone_number is not valid or country code is missing", where });
                            incorrectPhoneNumberList.push(phone_number)
                        }
                    }
                    else {
                        // Logger.error("CommunicationConfigError", { "message": "phone_number is not valid or country code is missing", where });
                        incorrectPhoneNumberList.push(phone_number)
                    }
                }
            }
            console.log("🚀 ~ returnnewPromise ~ incorrectPhoneNumberList:", incorrectPhoneNumberList)
            if (incorrectPhoneNumberList.length > 0) {
                let err = {
                    "message": "phone_number is invalid or country code is missing",
                    "stack": { "phone_number_list": incorrectPhoneNumberList }
                }
                reject(err)
            }
        }

        if (notificationEmailArray && notificationEmailArray.length > 0) {
            console.log("🚀 ~ returnnewPromise ~ notificationEmailArray:", notificationEmailArray)
            for (const attr in notificationEmailArray) {
                const element = notificationEmailArray[attr]; // individual email
                const email = element;

                console.log("🚀 ~ returnnewPromise ~ element:", element,email)
                where = {
                    email: email,
                }
                // now search the email in occupant and get the data need here the language.
                const occupant = await getOccupants(where).then(result => {
                    return (result);
                }).catch((err) => {
                    reject(err);
                });
                console.log("🚀 ~ occupant ~ occupant:", occupant)

                if(occupant){
                const notificationToken = await alertCommunicationHandler.getUserNotificationTokens(occupant.id)
                                    .catch((err) => {
                                        reject(err);
                                    });
                 console.log("🚀 ~ returnnewPromise ~ notificationToken:", notificationToken)
                                        
                if (notificationToken && notificationToken.length > 0) {
                    notificationTokenLists = lodash.map(notificationToken, 'token');
                    }
                console.log("🚀 ~ returnnewPromise ~ notificationTokenLists:", notificationTokenLists)

                let data = {
                    module: 'onetouch',
                    device_id: gateway_id,    
                    click_action: "FLUTTER_NOTIFICATION_CLICK",
                }
                var object = {
                    action_trigger_key: action_trigger_key,
                    one_touch_rule_id: oneTouchRuleId,
                    key: key,
                    type: 'onetouch',
                    name: name || null,
                    message: message,
                    language: occupant.language,
                    user_name: occupant.user_name,
                    first_last_name: occupant.first_last_name,
                    first_name: occupant.first_name,
                    last_name: occupant.last_name,
                    company_id: companyId,
                    gateway_id: gateway_id,
                    company_id: companyId,
                    notificationTokenList: notificationTokenLists,
                    notificationData: data
                }
                console.log("🚀 ~ returnnewPromise ~ object:", object)
                await notificationQueueProducer.sendProducer(object)
            }
            }
        }
        resolve();
    })
}
// flow starts from here//
const oneTouchCommunicationConfig = function (obj) {
    return new Promise(async (resolve, reject) => {
        let name = "";
        const action_trigger_key = obj.value;
        const gateway_code = obj.deviceCode;
        let deviceExist = null;
        let oneTouchRuleIdExist = null;
        let oneTouchRuleId = null;
        let oneTouchCommunicationConfigData = null;
        if (action_trigger_key) {
            oneTouchCommunicationConfigData = await getOneTouchCommunicationConfig(action_trigger_key).then((result) => {
                return result;
            }).catch((err) => {
                reject(err);
            });
        }

        if (gateway_code) {
            deviceExist = await getDeviceData(gateway_code).then((result) => {
                return result;
            }).catch((err) => {
                reject(err);
            });
        }

        if (oneTouchCommunicationConfigData && deviceExist) {
            oneTouchRuleId = oneTouchCommunicationConfigData.one_touch_rule_id;
            oneTouchRuleIdExist = await findOneTouchRuleData(oneTouchRuleId).then((result) => {
                return result;
            }).catch((err) => {
                reject(err);
            });
            if (oneTouchRuleIdExist && oneTouchRuleIdExist.rule.name) {
                name = oneTouchRuleIdExist.rule.name;
                await manageSend(oneTouchCommunicationConfigData, deviceExist.id, deviceExist.device_code, name, oneTouchRuleId).catch((err) => {
                    reject(err);
                });
            }
        }
        resolve();
    })
}


module.exports = {
    oneTouchCommunicationConfig, getOccupants
}
