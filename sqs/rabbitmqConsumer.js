const amqp = require('amqplib');
const { RateLimiterRedis } = require("rate-limiter-flexible");
const redisClient = require("../cache/redisClient");

// RabbitMQ connection parameters (adjust as needed)
const RABBITMQ_HOST = 'amqp://warrenxia:xia123@ec2-63-179-63-183.eu-central-1.compute.amazonaws.com'; // or amqp://user:pass@host/vhost
const RABBITMQ_QUEUE = 'SQSUpdateAccepted';
const rateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    points: parseInt(process.env.DEVICE_UPDATE_ACCEPTECTED_TOPIC_QUEUE_RATELIMIT), 
    duration: parseInt(process.env.DEVICE_UPDATE_ACCEPTECTED_TOPIC_QUEUE_RATELIMIT_DURATION) 
});
let paused = false
var { manageDeviceUpdateAccepted } = require('../handler/DeviceUpdateHandler')
const Logger = require('../Logger');

async function consumeMessages() {
  try {
    // 1. Establish a Connection
    const connection = await amqp.connect(RABBITMQ_HOST);
    console.log('Connected to RabbitMQ');

    // 2. Create a Channel
    const channel = await connection.createChannel();

    // 3. Declare the Queue (make sure it exists)
    await channel.assertQueue(RABBITMQ_QUEUE, { durable: true }); // Durable queue

    console.log(` [*] Waiting for messages in ${RABBITMQ_QUEUE}. To exit press CTRL+C`);

    // 4. Consume Messages
    channel.consume(RABBITMQ_QUEUE, async (message) => {
        if (paused) {
            console.log("RABBITMQ Rate limit hit, added back to queue", message.Body)
            throw new Error('RABBITMQ Rate limit exceeded');
        }
        try {
            await rateLimiter.consume(`update_acccepted-sqs-${instanceId}`);
        } catch (rejRes) {
             console.log("RABBITMQ Rate limit hit", {
                instance: instanceId,
                retryInMs: rejRes.msBeforeNext
            })
            if (!paused) {
                console.log("RABBITMQ Rate limit hit,pause the consumption",instanceId, message.Body)
                paused = true;
                const now = Date.now();
                const msPassed = now % 1000;
                // const msRemaining = (parseInt(process.env.ACTIVITY_LOG_QUEUE_RATELIMIT_DURATION)*1000) - msPassed;
                const msRemaining = rejRes.msBeforeNext || (parseInt(process.env.DEVICE_UPDATE_ACCEPTECTED_TOPIC_QUEUE_RATELIMIT_DURATION)*1000);
                console.log("LimiterLog",instanceId,"SQS Consumption Stopped","Will start after",msRemaining)
                setTimeout(() => {
                    paused = false;
                    setImmediate(() => {
                        console.log("LimiterLog",instanceId,"SQS Consumption Started")
                    });
                }, msRemaining);
                console.log("RABBITMQ Rate limit exceeded", message.Body)
                throw new Error('RABBITMQ Rate limit exceeded');
            } else {
                console.log("RABBITMQ Rate limit hit, added back to queue", message.Body)
                throw new Error('Rate limit exceeded');
            }
        }
        if (!paused) {
        // console.log("processed event", message.Body)
        let obj = JSON.parse(message.Body)
        manageDeviceUpdateAccepted(obj).then(result => {

        }).catch(async err => {
            if (err && err.message) {
                Logger.error("Error", { "stack": err.stack, "msg": err.message });
            }
        })}
    }, {
      noAck: false // Important: Disable auto-acknowledgment
    });

    // Handle Connection Closure (Important)
    connection.on('close', () => {
      console.error('Connection to RabbitMQ closed.');
    });

    // Handle Errors (Important)
    connection.on('error', (err) => {
      console.error('RabbitMQ connection error:', err);
    });

    process.on('beforeExit', async () => {
      console.log('Closing RabbitMQ connection...');
      await channel.close();
      await connection.close();
    });

  } catch (error) {
    console.error('RABBITMQ Failed to connect to RabbitMQ:', error);
  }
}

var startConsumer = function () {
    consumeMessages();
}

module.exports = {
    startConsumer
}