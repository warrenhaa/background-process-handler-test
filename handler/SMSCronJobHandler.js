const models = require('../models');
const Logger = require('../Logger');
const twilio = require("twilio");
let { deleteActivityLogs, deleteMultipleActivityLogs, addActivityLog } = require('../services/ActivityLogService')
const { getCompany } = require('../cache/Companies');
var AWS = require("aws-sdk");
const { Constant } = require('../Constants');
const { Entities } = require('../utils/Entities');
const {
    Op,
} = models.Sequelize;

AWS.config.update({
    region: process.env.SMS_AWS_REGION,
    accessKeyId: process.env.SMS_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.SMS_AWS_SECRET_ACCESS_KEY
});
var SNS = new AWS.SNS({ apiversion: process.env.API_VERSION });

let intervalId;
let accountSid;
let apiKey;
let apiSecret;
let client;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_API_KEY && process.env.TWILIO_API_SECRET && process.env.TWILIO_PHONE_NUMBER) {
    accountSid = process.env.TWILIO_ACCOUNT_SID;
    apiKey = process.env.TWILIO_API_KEY;
    apiSecret = process.env.TWILIO_API_SECRET;
    client = twilio(apiKey, apiSecret, { accountSid: accountSid });
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

const sendTwillioSMS = async function (body, PhoneNumber) {
    const message = await client.messages.create({
        body: body,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: PhoneNumber,
    });
    console.log("🚀  sendSMS  message:", message)
}

const manage = function () {
    return new Promise(async (resolve, reject) => {
        try {
            let startTime = new Date().toISOString();
            startTime = new Date(startTime);
            let smsRecord = await models.sms_handler.findAll({
                where: {
                    created_at: {
                        [Op.lte]: startTime
                    }
                }
            }).then(result => {
                return (result);
            }).catch(err => {
                reject(err);
            });
            let constants = await Constant('constants')
            let configs = constants.SMSCronConfigs
            if (!configs) {
                configs = {
                    "IS_CRON_ACTIVE": true,
                    "MIN_CHECK_DURATION": 3000,
                    "REPEAT_CHECK_DURATION": 30000,
                    "INTERVAL_DELAY": 3000
                }
            }
            const company = await getCompany(null, process.env.COMPANY_CODE).then(result => {
                return (result);
            }).catch(err => {
                reject(err);
            });
            if (!company || !company.id) {
                Logger.info("Info-Error", { "message": "Environment variable COMPANY_CODE is wrong, not found COMPANY_CODE to postgres db.", value: process.env.COMPANY_CODE })
                resolve()
            } let isTwillioEnabled = null;
            if (company.alert_configs) {
                isTwillioEnabled = company.alert_configs.twillio_enabled
            }
            console.log("🚀 ~ file: SMSCronJobHandler.js:92 ~ isTwillioEnabled:", isTwillioEnabled)
            let minCheckDuration = configs.MIN_CHECK_DURATION
            let repeatCheckDuration = configs.REPEAT_CHECK_DURATION
            // console.log("🚀 ~ file: SMSCronJobHandler.js:182 ~ smsRecord:", smsRecord)
            let timeBeforeStartTime = new Date(startTime.getTime() - minCheckDuration);
            console.log("🚀 ~ file: SMSCronJobHandler.js:185 ~ timeBeforeStartTime:", timeBeforeStartTime)
            // Create a Set to track unique phone numbers
            // Filter records where created_at is between timeBeforeStartTime and start_time
            const RecordsBetween3Sec = smsRecord.filter(record => {
                const createdAt = new Date(record.created_at);
                return createdAt >= timeBeforeStartTime && createdAt <= startTime;
            });
            console.log("🚀 ~ file: SMSCronJobHandler.js:189 ~ RecordsBetween3Sec:", RecordsBetween3Sec)

            // Filter records where created_at is before timeBeforeStartTime, 
            const RecordsBefore3Sec = smsRecord.filter(record => {
                const createdAt = new Date(record.created_at);
                return createdAt < timeBeforeStartTime;
            });
            console.log("🚀 ~ file: SMSCronJobHandler.js:207 ~ RecordsBefore3Sec:", RecordsBefore3Sec)
            // Create a Set to track phone numbers from list1
            const phoneNumbersList1 = new Set(RecordsBetween3Sec.map(record => record.phone_number));

            // Filter list2 to exclude records that have phone numbers present in list1
            const mainList = RecordsBefore3Sec.filter(record => !phoneNumbersList1.has(record.phone_number));
            console.log("🚀 ~ file: SMSCronJobHandler.js:213 ~ mainList:", mainList)
            const time30SecondsAgo = new Date(startTime.getTime() - repeatCheckDuration);
            console.log("🚀 ~ file: SMSCronJobHandler.js:209 ~ time30SecondsAgo:", time30SecondsAgo)


            // Filter list2 to include records that have phone numbers present in list1 and time is 30 sec ago
            let RecordsBefore30Sec = RecordsBefore3Sec.filter(record => {
                return phoneNumbersList1.has(record.phone_number) && record.created_at.getTime() <= time30SecondsAgo.getTime();
            });
            const mergedList = mainList.concat(RecordsBefore30Sec);
            console.log("🚀 ~ mergedList:", mergedList);

            // Group messages by phone_number
            const groupedMessages = {};
            let deleteToBeIds = [];
            mergedList.forEach(record => {
                if (!groupedMessages[record.phone_number]) {
                    groupedMessages[record.phone_number] = [];
                }
                groupedMessages[record.phone_number].push(record); // Store whole record for formatting
                deleteToBeIds.push(record.id);
            });
            console.log("🚀 ~ file: SMSCronJobHandler.js:228 ~ deleteToBeIds:", deleteToBeIds)

            // Combine and format messages
            Object.keys(groupedMessages).forEach(phoneNumber => {
                const records = groupedMessages[phoneNumber];
                if (records.length > 1) {
                    let newList = []
                    records.forEach(element => {
                        let record = element
                        let tempList = []
                        newList.forEach(element2 => {
                            if (element.phone_number == element2.phone_number && element.message == element2.message
                                && element.module == element2.module && element.created_at >= element2.created_at) {
                                tempList = newList.filter(newelement => !(element2.id == newelement.id));
                            }
                        })
                        newList = tempList
                        if (!newList.includes(record)) {
                            newList.push(record)
                        }
                    });
                    //skipping duplicate messages 
                    // Combine messages for this phone number
                    const combinedMessages = newList.map(record => {
                        return `${record.module} - ${record.message}`;
                    }).join('\n'); // Join messages with newline
                    if (isTwillioEnabled == true && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_API_KEY && process.env.TWILIO_API_SECRET
                        && process.env.TWILIO_PHONE_NUMBER) {
                        sendTwillioSMS(combinedMessages, phoneNumber).then(result => {
                            try {
                                addActivityLog(Entities.SMS.entity_name, Entities.SMS.event_name.sent, { phoneNumber, newList }, "SMS sent", newList[0].company_id, newList[0].company_id,)
                            } catch (error) {
                                addActivityLog(Entities.SMS.entity_name, Entities.SMS.event_name.error, { error }, "SMS error", newList[0].company_id, newList[0].company_id)
                                Logger.error("Error", { "msg": error.message })
                                reject(error);
                            }

                        }).catch(err => {
                            addActivityLog(Entities.SMS.entity_name, Entities.SMS.event_name.error, { err }, "SMS error", newList[0].company_id, newList[0].company_id)
                            if (err && err.message) {
                                Logger.error("Error", { "stack": err.stack, "msg": err.message })
                            }
                            reject(err);
                        })
                    } else {
                        sendSMS(combinedMessages, phoneNumber).then(result => {
                            try {
                                addActivityLog(Entities.SMS.entity_name, Entities.SMS.event_name.sent, { phoneNumber, newList }, "SMS sent", newList[0].company_id, newList[0].company_id,)
                            } catch (error) {
                                addActivityLog(Entities.SMS.entity_name, Entities.SMS.event_name.error, { error }, "SMS error", newList[0].company_id, newList[0].company_id)
                                Logger.error("Error", { "msg": error.message })
                                reject(error);
                            }

                        }).catch(err => {
                            addActivityLog(Entities.SMS.entity_name, Entities.SMS.event_name.error, { err }, "SMS error", newList[0].company_id, newList[0].company_id)
                            if (err && err.message) {
                                Logger.error("Error", { "stack": err.stack, "msg": err.message })
                            }
                            reject(err);
                        })
                    }
                } else {
                    // If only one message, format it directly
                    const record = records[0];
                    const formattedMessage = `${record.module} - ${record.message}`;
                    if (isTwillioEnabled == true && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_API_KEY && process.env.TWILIO_API_SECRET
                        && process.env.TWILIO_PHONE_NUMBER) {
                        sendTwillioSMS(formattedMessage, phoneNumber).then(result => {
                            try {
                                addActivityLog(Entities.SMS.entity_name, Entities.SMS.event_name.sent, { phoneNumber, records }, "SMS sent", records[0].company_id, records[0].company_id,)
                            } catch (error) {
                                addActivityLog(Entities.SMS.entity_name, Entities.SMS.event_name.error, { error }, "SMS error", records[0].company_id, records[0].company_id)
                                Logger.error("Error", { "msg": error.message })
                                reject(error);
                            }

                        }).catch(err => {
                            addActivityLog(Entities.SMS.entity_name, Entities.SMS.event_name.error, { err }, "SMS error", records[0].company_id, records[0].company_id)
                            if (err && err.message) {
                                Logger.error("Error", { "stack": err.stack, "msg": err.message })
                            }
                            reject(err);
                        })
                    } else {
                        sendSMS(formattedMessage, phoneNumber).then(result => {
                            try {
                                addActivityLog(Entities.SMS.entity_name, Entities.SMS.event_name.sent, { phoneNumber, records }, "SMS sent", records[0].company_id, records[0].company_id,)
                            } catch (error) {
                                addActivityLog(Entities.SMS.entity_name, Entities.SMS.event_name.error, { error }, "SMS error", records[0].company_id, records[0].company_id)
                                Logger.error("Error", { "msg": error.message })
                                reject(error);
                            }

                        }).catch(err => {
                            addActivityLog(Entities.SMS.entity_name, Entities.SMS.event_name.error, { err }, "SMS error", records[0].company_id, records[0].company_id)
                            if (err && err.message) {
                                Logger.error("Error", { "stack": err.stack, "msg": err.message })
                            }
                            reject(err);
                        })
                    }
                }
            });
            await models.sms_handler.destroy({
                where: {
                    id: {
                        [Op.in]: deleteToBeIds
                    },
                }
            }).then(result => {
                console.log("🚀 ~ file: SMSCronJobHandler.js:292 ~ result:", result)
                resolve(result)
            }).catch(err => {
                reject(err)
            })

        } catch (error) {
            reject(error)
        }
    })
}
const startInterval = (intervalDelay) => {
    if (!intervalId) {
        intervalId = setInterval(manage, intervalDelay);
        console.log('Interval started');
    }
};

// Function to stop the cron job
const stopInterval = () => {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log('Interval stopped');
    }
};
const fetchCronJobStatus = async () => {
    try {
        let constants = await Constant('constants')
        let configs = constants.SMSCronConfigs
        return configs ? configs.IS_CRON_ACTIVE : true;
    } catch (error) {
        console.error('Error fetching cron job status:', error);
        return true;
    }
};

// Polling function to check for cron job status changes
const pollCronJobStatus = async () => {
    console.log("🚀 ~ pollCronJobStatus ~ isActive:")
    const isActive = await fetchCronJobStatus();
    console.log("🚀 ~ pollCronJobStatus ~ isActive:", isActive)
    let constants = await Constant('constants')
    let configs = constants.SMSCronConfigs
    if (!configs) {
        configs = {
            "IS_CRON_ACTIVE": true,
            "MIN_CHECK_DURATION": 3000,
            "REPEAT_CHECK_DURATION": 30000,
            "INTERVAL_DELAY": 3000
        }
    }
    if (isActive && !intervalId) {
        startInterval(configs.INTERVAL_DELAY);
    } else if (!isActive && intervalId) {
        stopInterval();
    }
};
// Start polling every 30 minutes
// 1800000
// pollCronJobStatus();
// setInterval(pollCronJobStatus, 1800000);


module.exports = {
    manage
}