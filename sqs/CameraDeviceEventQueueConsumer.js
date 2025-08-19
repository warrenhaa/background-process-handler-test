const { Consumer } = require('sqs-consumer');
const AWS = require('aws-sdk');
const https = require('https');
const Logger = require('../Logger');
const JSON5 = require('json5')
let { manageCameraDeviceEventQueue } = require('../handler/CameraDeviceHandler')
var { isValidJSON } = require('../Helper')
const { createIssue, getIssue } = require('../services/GitlabTicketService')
const {RateLimiterRedis} = require("rate-limiter-flexible");
const redisClient = require("../cache/redisClient");
const os = require('os'); 

AWS.config.update({
    region: process.env.SQS_AWS_REGION,
    accessKeyId: process.env.SQS_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.SQS_AWS_SECRET_ACCESS_KEY
});

let paused = false
const instanceId = os.hostname(); 
const rateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    points:  parseInt(process.env.SQS_CAMERA_DEVICE_EVENT_QUEUE_RATELIMIT) || 100, // Per 1 second
    duration: parseInt(process.env.SQS_CAMERA_DEVICE_EVENT_QUEUE_RATELIMIT_DURATION) || 1// Per 1 second
});

let pointer = 0
const app = Consumer.create({
    queueUrl: process.env.SQS_CAMERA_DEVICE_EVENT_QUEUE_URL,
    batchSize: parseInt(process.env.SQS_CAMERA_DEVICE_EVENT_QUEUE_RATELIMIT),
    handleMessage: async (message) => {
        if (paused) {
            throw new Error('Rate limit exceeded');
        }
        try {
            await rateLimiter.consume(`camera-device-events-sqs-${instanceId}`);
        } catch (rejRes) {

            if (!paused) {
                paused = true;
                const now = Date.now();
                const msPassed = now % 1000;
                // const msRemaining = (parseInt(process.env.ACTIVITY_LOG_QUEUE_RATELIMIT_DURATION)*1000) - msPassed;
                const msRemaining = rejRes.msBeforeNext || (parseInt(process.env.SQS_CAMERA_DEVICE_EVENT_QUEUE_RATELIMIT_DURATION)*1000);
                app.stop();
                setTimeout(() => {
                    paused = false;
                    setImmediate(() => {
                        app.start();
                    });
                }, msRemaining);
                throw new Error('Rate limit exceeded');
            } else {
                throw new Error('Rate limit exceeded');
            }
        }
        if (!paused) {
        // console.log("🚀 ~ file: CameraDeviceEventQueueConsumer.js:16 ~ handleMessage: ~ message:", message)
        pointer = pointer + 1
        let isValidObj = await isValidJSON(message.Body)
        // console.log("🚀 ~ file: CameraDeviceEventQueueConsumer.js:33 ~ handleMessage: ~ isValidObj:", isValidObj)
        if (isValidObj === true) {
            var obj = { ...JSON5.parse(message.Body) }
            // console.log("🚀 ~ file: CameraDeviceEventQueueConsumer.js:18 ~ handleMessage: ~ obj:", obj)
            Logger.info("CameraDeviceEventQueueConsumer", obj);
            manageCameraDeviceEventQueue(obj).then(result => {

            }).catch(async err => {
                if (err && err.message) {
                    Logger.error("Error", { "stack": err.stack, "msg": err.message });
                    var company_code = process.env.COMPANY_CODE;
                    var params = {};
                    var jsonError = { "stack": err?.stack || null, "obj": obj, "Error": err }
                params["search"] = err?.message || "DeviceStatusUpdaterError";
                    params["title"] = err?.message || "DeviceStatusUpdaterError";
                    params["labels"] = [company_code];
                    params["description"] = '```json' + JSON.stringify(jsonError, null, 2) + '```'
                    const issueExists = await getIssue(params).catch(err => {
                            console.log("Error- CameraDeviceEventqueueConsumer CreateIssue Error", err)
                    })
                    if (issueExists == false) {
                        await createIssue(params).catch(err => {
                            console.log("Error- CameraDeviceEventqueueConsumer CreateIssue Error", err)
                        })
                    }

                }
            })
        } else {
            Logger.info("Object sent to CameraDeviceEventQueueConsumer is invalid", { "object": message.Body })
        }
        }
    },
    sqs: new AWS.SQS({
        httpOptions: {
            agent: new https.Agent({
                keepAlive: true
            })
        }
    })
});

app.on('error', (err) => {
    Logger.error("Error ", { "stack": err.stack, "msg": err.message })
    startConsumer()
});

app.on('processing_error', (err) => {
    Logger.error("Processing-Error ", { "stack": err.stack, "msg": err.message })
});

app.on('timeout_error', (err) => {
    Logger.error("Timeout-Error ", { "stack": err.stack, "msg": err.message })
    startConsumer()
});

var startConsumer = function () {
    app.start();
}


module.exports = {
    startConsumer
}
