const { Consumer } = require('sqs-consumer');
const AWS = require('aws-sdk');
const https = require('https');
var { manageDeviceUpdate } = require('../handler/DeviceUpdateHandler')
var { rulesTriggerEvaluator } = require('../services/EventRuleTriggerEvaluator')
const Logger = require('../Logger');
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
    points:  parseInt(process.env.SQS_RULE_ENGINE_RATELIMIT) ,
    duration: parseInt(process.env.SQS_RULE_ENGINE_RATELIMIT_DURATION) 
});

let pointer = 0

const app = Consumer.create({
    queueUrl: process.env.SQS_RULE_ENGINE_URL,
    batchSize: parseInt(process.env.SQS_RULE_ENGINE_BATCHSIZE),
    handleMessage: async (message) => {
        if (paused) {
            throw new Error('Rate limit exceeded');
        }
        try {
            await rateLimiter.consume(`update-document-sqs-${instanceId}`);
            //console.log("Rate limit consumed", rate);
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
                const msRemaining = rejRes.msBeforeNext || (parseInt(process.env.SQS_RULE_ENGINE_RATELIMIT_DURATION)*1000);
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
        pointer = pointer + 1
        let obj = { ...JSON.parse(message.Body) }
        //var object = { ...JSON.parse(message.Body) }
        // Logger.info("Device-Data-Message-Received", { "pointer": pointer })
        //Logger.info("Device-Data-Message-Received", { "object": object })


        manageDeviceUpdate(obj, pointer).then(result => {
            // rulesTriggerEvaluator(object, result.pointer)
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
                    console.log("Error- DeviceDataConsumer CreateIssue Error", err);
                })
                if (issueExists == false) {
                    await createIssue(params).catch(err => {
                        console.log("Error- DeviceDataConsumer CreateIssue Error", err);
                    })
                }
            }
        })
    }

    },
    // sqs: new AWS.SQS()
    sqs: new AWS.SQS({
        httpOptions: {
            agent: new https.Agent({
                keepAlive: true
            })
        }
    })
});

app.on('error', (err) => {
    console.error(err.message);
    Logger.error("Error ", { "stack": err.stack, "msg": err.message })
    startConsumer()
});

app.on('processing_error', (err) => {
    // console.error(err.message);
    // Logger.error("Processing-Error ", { "stack": err.stack, "msg": err.message })
});

app.on('timeout_error', (err) => {
    console.error(err.message);
    Logger.error("Timeout-Error ", { "stack": err.stack, "msg": err.message })
    startConsumer()
});

var startConsumer = function () {
    app.start();
}

module.exports = {
    startConsumer
}
