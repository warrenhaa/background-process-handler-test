const { Consumer } = require('sqs-consumer');
const AWS = require('aws-sdk');
const https = require('https');
const Logger = require('../Logger');
const JSON5 = require('json5')
let { manageCameraSubscriptionQueue } = require('../handler/SubscriptionHandler')
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
    points:  parseInt(process.env.SQS_CAMERA_PAYMENT_UPDATE_RATELIMIT) ,
    duration: parseInt(process.env.SQS_CAMERA_PAYMENT_UPDATE_RATELIMIT_DURATION) 
});


let pointer = 0
const app = Consumer.create({
    queueUrl: process.env.SQS_CAMERA_PAYMENT_UPDATE_URL,
    batchSize: parseInt(process.env.SQS_CAMERA_PAYMENT_UPDATE_BATCHSIZE),
    handleMessage: async (message) => {
        if (paused) {
            throw new Error('Rate limit exceeded');
        }
        try {
            await rateLimiter.consume(`camera-payment-update-sqs-${instanceId}`);
        } catch (rejRes) {
            // console.log("Rate limit hit", {
            //     instance: instanceId,
            //     retryInMs: rejRes.msBeforeNext
            // })
            if (!paused) {
                paused = true;
                const now = Date.now();
                const msPassed = now % 1000;
                // const msRemaining = (parseInt(process.env.ACTIVITY_LOG_QUEUE_RATELIMIT_DURATION)*1000) - msPassed;
                const msRemaining = rejRes.msBeforeNext || (parseInt(process.env.SQS_CAMERA_PAYMENT_UPDATE_RATELIMIT_DURATION)*1000);
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
        console.log("🚀 ~ file: manageCameraSubscriptionQueue.js:18 ~ handleMessage: ~ message:", message)
        pointer = pointer + 1
        let isValidObj = await isValidJSON(message.Body)
        console.log("🚀 ~ file: manageCameraSubscriptionQueue.js:21 ~ handleMessage: ~ isValidObj:", isValidObj)
        if (isValidObj === true) {
            var obj = {...JSON5.parse(message.Body)}
            console.log("🚀 ~ file: manageCameraSubscriptionQueue.js:24 ~ handleMessage: ~ obj:", obj)
            manageCameraSubscriptionQueue(obj).then(result => {

            }).catch(async err => {
                if (err && err.message) {
                    Logger.error("Error", {"stack": err.stack, "msg": err.message});
                    var company_code = process.env.COMPANY_CODE;
                    var params = {};
                    var jsonError = {"stack": err?.stack || null, "obj": obj, "Error": err}
                    params["search"] = err?.message || "DeviceStatusUpdaterError";
                    params["title"] = err?.message || "DeviceStatusUpdaterError";
                    params["labels"] = [company_code];
                    params["description"] = '```json' + JSON.stringify(jsonError, null, 2) + '```'
                    const issueExists = await getIssue(params).catch(err => {
                        console.log("Error- CameraPaymentUpdateSQSConsumer CreateIssue Error", err);
                    })
                    if (issueExists == false) {
                        await createIssue(params).catch(err => {
                            console.log("Error- CameraPaymentUpdateSQSConsumer CreateIssue Error", err);
                        })
                    }

                }
            })
        } else {
            Logger.info("Object sent to CameraPaymentUpdateSQSConsumer is invalid", {"object": message.Body})
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
// console.log("outside:===============");
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
