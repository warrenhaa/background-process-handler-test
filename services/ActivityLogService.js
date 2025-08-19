const models = require('../models');
const { Op } = models.Sequelize;
var activityLogQueueProducer = require('../sqs/ActivityLogQueueProducer')
const { Entities } = require('../utils/Entities');
//check activity logs exists
var checkActivityLogExists = function (entity_id) {
    return new Promise((resolve, reject) => {
        models.activity_logs.findAll({
            where: {
                entity_id
            }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}
//delete Activity logs ? 
var deleteActivityLogs = function (entity_id, jobId) {
    return new Promise((resolve, reject) => {
        checkActivityLogExists(entity_id).then(result => {
            if (result && result.length > 0) {
                models.activity_logs.destroy({
                    where: {
                        entity_id,
                        event_name: {
                            [Op.notIn]: [Entities.devices.event_name.device_added,
                            Entities.devices.event_name.gateway_added,
                            Entities.deleteDevice.event_name.owner_unregistered_gateway,
                            Entities.deleteDevice.event_name.gateway_unregistered,
                            Entities.deleteDevice.event_name.device_delete,
                            Entities.deleteDevice.event_name.gateway_delete]
                        }
                    }
                }).then(result => {
                    resolve(result)
                }).catch(err => {
                    reject(err);
                });
            } else {
                resolve(result)
            }
        }).catch(err => {
            reject(err);
        });
    })
}
//checking multiple activity logs
var checkMultipleActivityLogExists = function (entity_ids) {
    return new Promise((resolve, reject) => {
        models.activity_logs.findAll({
            where: {
                entity_id: {
                    [Op.in]: entity_ids
                }
            }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}
//delete multiple activity logs
var deleteMultipleActivityLogs = function (entity_ids, jobId) {
    return new Promise((resolve, reject) => {
        checkMultipleActivityLogExists(entity_ids).then(result => {
            if (result && result.length > 0) {
                models.activity_logs.destroy({
                    where: {
                        entity_id: {
                            [Op.in]: entity_ids
                        }
                    }
                }).then(result => {
                    resolve(result)
                }).catch(err => {
                    reject(err);
                });
            } else {
                resolve(result)
            }
        }).catch(err => {
            reject(err);
        });
    })
}

var addActivityLog = function (entity, event_name, data, notes, entity_id, company_id, placeholders_data) {
    return new Promise((resolve, reject) => {
        if (!placeholders_data) {
            placeholders_data = {}
        }
        models.activity_logs.create({
            entity, event_name, data, notes, entity_id, company_id, event_time: new Date(), placeholders_data
        }).then(async(result) => {
            const activityLogConfigData = await models.activity_log_communication_configs.findOne({
          where: {
            event_name
          },
        }).catch((err) => {
          throw err;
        });
            
        if (activityLogConfigData && (activityLogConfigData.email_enabled === true
          || activityLogConfigData.sms_enabled === true || activityLogConfigData.notification_enabled === true)){
                activityLogQueueProducer.sendProducer(result)
            }
            resolve(result)
        }).catch(err => {
            reject(err);
        })
    })
}                                                                                                                          

module.exports = {
    deleteActivityLogs, deleteMultipleActivityLogs, addActivityLog
}
