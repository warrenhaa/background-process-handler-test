var { Producer } = require('sqs-producer');
var { getRandomString } = require('../Helper')
const Logger = require('../Logger')
const producer = Producer.create({
    queueUrl: process.env.ACTIVITY_LOG_QUEUE_URL,
    region: process.env.SQS_AWS_REGION,
    accessKeyId: process.env.SQS_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.SQS_AWS_SECRET_ACCESS_KEY
});

var sendProducer = async function (event) {
    try {
        var id = getRandomString()
        var obj = {
            id: id,
            body: JSON.stringify(event)
        }
        await producer.send([obj])
    } catch (error) {
        Logger.error("Error ", { "error": error.stack })
    }

}


module.exports = {
    sendProducer
}

