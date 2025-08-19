var { Producer } = require('sqs-producer');
var { getRandomString } = require('../Helper')
const Logger = require('../Logger')

let producer = null
if (process.env.SQS_SAFE_4_CAMERA_QUEUE_URL) {
  producer = Producer.create({
    queueUrl: process.env.SQS_SAFE_4_CAMERA_QUEUE_URL,
    region: process.env.SQS_AWS_REGION,
    accessKeyId: process.env.SQS_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.SQS_AWS_SECRET_ACCESS_KEY,
  });
}

var sendProducer = async function (event) {
    if (process.env.SQS_SAFE_4_CAMERA_QUEUE_URL && producer) {
        try {
            var id = getRandomString()
            var obj = {
                id: id,
                body: JSON.stringify(event)
            }
            await producer.send([obj])
        } catch (error) {
            Logger.error("Error ", { "error": error.stack })
            console.log(error)
        }
    }
}


module.exports = {
    sendProducer
}

