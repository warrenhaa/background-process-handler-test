const { Consumer } = require('sqs-consumer');
const AWS = require('aws-sdk');
const https = require('https');
const Logger = require('../Logger');
let { manageCameraDeviceEventQueue } = require('../handler/CameraDeviceHandler')
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
    points:  parseInt(process.env.SQS_CAMERA_DEVICE_ACTION_QUEUE_RATELIMIT)  ,
    duration:parseInt(process.env.SQS_CAMERA_DEVICE_ACTION_QUEUE_RATELIMIT_DURATION) 
});

let pointer = 0
const app = Consumer.create({
    queueUrl: process.env.SQS_CAMERA_DEVICE_ACTION_QUEUE_URL,
    batchSize: parseInt(process.env.SQS_CAMERA_DEVICE_ACTION_QUEUE_BATCHSIZE),
    handleMessage: async (message) => {
        if (paused) {
            throw new Error('Rate limit exceeded');
        }
        try {
            await rateLimiter.consume(`camera-action-events-sqs-${instanceId}`);
        } catch (rejRes) {
            if (!paused) {
                paused = true;
                const now = Date.now();
                const msPassed = now % 1000;
                // const msRemaining = (parseInt(process.env.ACTIVITY_LOG_QUEUE_RATELIMIT_DURATION)*1000) - msPassed;
                const msRemaining = rejRes.msBeforeNext || (parseInt(process.env.SQS_CAMERA_DEVICE_ACTION_QUEUE_RATELIMIT_DURATION)*1000);
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
        pointer = pointer + 1
        var obj = JSON.parse(message.Body)
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
