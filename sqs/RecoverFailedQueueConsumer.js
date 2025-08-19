const { Consumer } = require('sqs-consumer');
const AWS = require('aws-sdk');
const https = require('https');
const Logger = require('../Logger');
const { createOccupant } = require('../handler/RecoverFailedHandler')
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
  points:  parseInt(process.env.RECOVER_FAILED_QUEUE_RATELIMIT) ,
  duration:parseInt(process.env.RECOVER_FAILED_QUEUE_RATELIMIT_DURATION) 
});

const app = Consumer.create({
  queueUrl: process.env.RECOVER_FAILED_QUEUE_URL,
  batchSize: parseInt(process.env.RECOVER_FAILED_QUEUE_BATCHSIZE),
  handleMessage: async (message) => {
    if (paused) {
      throw new Error('Rate limit exceeded');
  }
    try {
      await rateLimiter.consume(`recover-failed-sqs-${instanceId}`);
    } catch (rejRes) {
      console.log("Rate limit hit", {
        instance: instanceId,
        retryInMs: rejRes.msBeforeNext
    })
    if (!paused) {
        paused = true;
        const now = Date.now();
        const msPassed = now % 1000;
        // const msRemaining = (parseInt(process.env.ACTIVITY_LOG_QUEUE_RATELIMIT_DURATION)*1000) - msPassed;
        const msRemaining = rejRes.msBeforeNext || (parseInt(process.env.RECOVER_FAILED_QUEUE_RATELIMIT_DURATION)*1000);
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
    //console.log("🚀 ~ file: CreateOccupantErrorQueueConsumer.js:9 ~ message:", message)
    let obj = JSON.parse(message.Body)
    //console.log("🚀 ~ file: CreateOccupantErrorQueueConsumer.js:12 ~ obj:", obj)
    createOccupant(obj).then(result => {
      console.log(result)
    }).catch(async err => {
      console.log("Error- CreateOccupantErrorQueueConsumer Create Occupant Error", err);
    })
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
