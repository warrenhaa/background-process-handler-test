require('dotenv').config({ path: './.env' })
var express = require('express');
require('./models');
require('./categoryb_models');
const sqsDeviceUpdateConsumer = require('./sqs/sqsDeviceUpdateConsumer')
const sqsDeviceAcceptedConsumer = require('./sqs/sqsDeleteAcceptedConsumer')
const sqsRuleHandlerConsumer = require('./sqs/sqsRuleHandlerConsumer')
const genericJobQueueConsumer = require('./sqs/GenericJobQueueConsumer')
const emailQueueConsumer = require('./sqs/EmailQueueConsumer')
const smsQueueConsumer = require('./sqs/SMSQueueConsumer')
const notificationQueueConsumer = require('./sqs/NotificationQueueConsumer')
const activityLogQueueConsumer = require('./sqs/ActivityLogQueueConsumer')
const deviceDataConsumer = require('./sqs/DeviceDataConsumer')
const DeviceUpdateAcceptedConsumer = require('./sqs/DeviceUpdateAcceptedConsumer')
const rabbitmqConsumer = require('./sqs/rabbitmqConsumer')

rabbitmqConsumer.startConsumer()
if ((process.env.INSTALLER_QUEUE_QUEUE_URL_ENABLE == 'true' || process.env.INSTALLER_QUEUE_QUEUE_URL_ENABLE == true) && process.env.INSTALLER_QUEUE_URL) {
    const installerQueueConsumer = require('./sqs/InstallerQueueConsumer.js')
    installerQueueConsumer.startConsumer()
}
if ((process.env.SQS_CAMERA_DEVICE_EVENT_QUEUE_URL_ENABLE == 'true' || process.env.SQS_CAMERA_DEVICE_EVENT_QUEUE_URL_ENABLE == true) && process.env.SQS_CAMERA_DEVICE_EVENT_QUEUE_URL) {
    const CameraDeviceEventQueueConsumer = require('./sqs/CameraDeviceEventQueueConsumer')
    CameraDeviceEventQueueConsumer.startConsumer()
}
if ((process.env.SQS_CAMERA_PAYMENT_UPDATE_URL_ENABLE == 'true' || process.env.SQS_CAMERA_PAYMENT_UPDATE_URL_ENABLE == true) && process.env.SQS_CAMERA_PAYMENT_UPDATE_URL) {
    const CameraPaymentUpdateSQSConsumer = require('./sqs/CameraPaymentUpdateSQSConsumer')
    CameraPaymentUpdateSQSConsumer.startConsumer()
}
if ((process.env.SUNSET_SUNRISE_QUEUE_URL_ENABLE == 'true' || process.env.SUNSET_SUNRISE_QUEUE_URL_ENABLE == true) && process.env.SUNSET_SUNRISE_QUEUE_URL) {
    const SunsetSunriseConsumer = require('./sqs/SunsetSunriseQueueConsumer.js')
    SunsetSunriseConsumer.startConsumer()
}
if ((process.env.SQS_DYNAMODB_TRIGGER_STREAM_URL_ENABLE == 'true' || process.env.SQS_DYNAMODB_TRIGGER_STREAM_URL_ENABLE == true) && process.env.SQS_DYNAMODB_TRIGGER_STREAM_URL) {
    const DynamoDBTriggerStream = require('./sqs/DynamoDBTriggerStreamConsumer')
    DynamoDBTriggerStream.startConsumer()
}
if ((process.env.SQS_CLOUD_BRIDGE_QUEUE_URL_ENABLE == 'true' || process.env.SQS_CLOUD_BRIDGE_QUEUE_URL_ENABLE == true) && process.env.SQS_CLOUD_BRIDGE_QUEUE_URL) {
    const CloudBridgeQueueConsumer = require('./sqs/CloudBridgeQueueConsumer')
    CloudBridgeQueueConsumer.startConsumer()
}
if ((process.env.RECOVER_FAILED_QUEUE_URL_ENABLE == 'true' || process.env.RECOVER_FAILED_QUEUE_URL_ENABLE == true) && process.env.OCCUPANT_ERROR_RECOVER_START && process.env.RECOVER_FAILED_QUEUE_URL) {
    const RecoverFailedQueueConsumer = require('./sqs/RecoverFailedQueueConsumer.js')
    RecoverFailedQueueConsumer.startConsumer()
}
if (process.env.SQS_DEVICE_UPDATE_URL_ENABLE == 'true' || process.env.SQS_DEVICE_UPDATE_URL_ENABLE == true) {
    sqsDeviceUpdateConsumer.startConsumer()
}
if (process.env.SQS_DEVICE_DELETE_URLENABLE == 'true' || process.env.SQS_DEVICE_DELETE_URLENABLE == true) {
    sqsDeviceAcceptedConsumer.startConsumer()
}
if (process.env.SQS_RULE_HANDLER_URL_ENABLE == 'true' || process.env.SQS_RULE_HANDLER_URL_ENABLE == true) {
    sqsRuleHandlerConsumer.startConsumer()
}
if (process.env.SQS_GENERIC_JOB_QUEUE_URL_ENABLE == 'true' || process.env.SQS_GENERIC_JOB_QUEUE_URL_ENABLE == true) {
    genericJobQueueConsumer.startConsumer()
}
if (process.env.ACTIVITY_LOG_QUEUE_URL_ENABLE == 'true' || process.env.ACTIVITY_LOG_QUEUE_URL_ENABLE == true) {
    activityLogQueueConsumer.startConsumer()
}
if (process.env.EMAIL_QUEUE_URL_ENABLE == 'true' || process.env.EMAIL_QUEUE_URL_ENABLE == true) {
    emailQueueConsumer.startConsumer()
}
if (process.env.SMS_QUEUE_URL_ENABLE == 'true' || process.env.SMS_QUEUE_URL_ENABLE == true) {
    smsQueueConsumer.startConsumer()
}
if (process.env.NOTIFICATION_QUEUE_URL_ENABLE == 'true' || process.env.NOTIFICATION_QUEUE_URL_ENABLE == true) {
    notificationQueueConsumer.startConsumer()
}
if (process.env.SQS_RULE_ENGINE_URL_ENABLE == 'true' || process.env.SQS_RULE_ENGINE_URL_ENABLE == true) {
    deviceDataConsumer.startConsumer()
}
if (process.env.DEVICE_UPDATE_ACCEPTECTED_TOPIC_QUEUE_URL_ENABLE == 'true' || process.env.DEVICE_UPDATE_ACCEPTECTED_TOPIC_QUEUE_URL_ENABLE == true) {
    DeviceUpdateAcceptedConsumer.startConsumer()
}


const port = process.env.PORT || 4000;
var app = express();
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-auth-token, x-company-code, authorization,x-access-token');
    res.header('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE, OPTIONS, PATCH');
    next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.get('/status', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
        status: true
    });
});
app.get('/version', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
        version: "v.0.92.0"
    });
});
const server = app.listen(port, () => {
    process.env.serverStatus = false
    console.info(`Server started on port ${port}`);
});


module.exports = { server }
