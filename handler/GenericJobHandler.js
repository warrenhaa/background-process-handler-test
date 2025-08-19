
const locationCheckInService = require('../services/LocationCheckInService');
const locationCheckOutService = require('../services/LocationCheckOutService');
const deleteOccupantService = require('../services/deleteOccupantService');
const deleteUserService = require('../services/deleteUserService');
const LocationService = require('../services/LocationService');
const deviceService = require('../services/deviceService');
const deleteOccupantGatewayServices = require('../services/deleteOccupantGatewayService');
const deleteLocationService = require('../services/deleteLocationService');
const shareDeviceToLocationManagerService = require('../services/ShareDeviceToLocationManagerService');
const shareDeviceExistingLocationManagerService = require('../services/shareDeviceExistingLocationManagerService');
const linkDevicesToTheOccupantsService = require('../services/LinkDevicesToTheOccupantsService');
const gatewayDashboardAttributesService = require('../services/GatewayDashboardAttributesService');
const { Entities } = require('../utils/Entities');

const { createJob, updateJob } = require('../services/JobsService')
const { addActivityLog } = require('../services/ActivityLogService')

var manage = function (obj) {
    return new Promise((resolve, reject) => {
        var type = obj.type
        var jobId = obj.jobId
        var companyId = obj.companyId
        if (type == 'shareDeviceExistingLocationManager') {
            shareDeviceExistingLocationManagerService.manage(obj)
                .then(result => {
                    updateJob("Finished", jobId)
                    addActivityLog(Entities.shareDeviceExistingLocationManagers.entity_name, Entities.shareDeviceExistingLocationManagers.event_name.job, obj, "Job finished.", jobId, companyId)
                    resolve()
                }).catch(err => {
                    updateJob("Failed", jobId)
                    addActivityLog(Entities.shareDeviceExistingLocationManagers.entity_name, Entities.shareDeviceExistingLocationManagers.event_name.job, obj, "Job failed.", jobId, companyId)
                    reject(err)
                })
        }
        if (type == 'deviceLocationAssignment') {
            shareDeviceToLocationManagerService.deviceLocationAssignment(obj)
                .then(result => {
                    updateJob("Finished", jobId)
                    addActivityLog(Entities.shareDeviceToLocationManagers.entity_name, Entities.shareDeviceToLocationManagers.event_name.job, obj, "Job finished.", jobId, companyId)
                    resolve()
                }).catch(err => {
                    updateJob("Failed", jobId)
                    addActivityLog(Entities.shareDeviceToLocationManagers.entity_name, Entities.shareDeviceToLocationManagers.event_name.job, obj, "Job failed.", jobId, companyId)
                    reject(err)
                })
        }
        if (type == 'userLocationAssignment') {
            shareDeviceToLocationManagerService.userLocationAssignment(obj)
                .then(result => {
                    updateJob("Finished", jobId)
                    addActivityLog(Entities.shareDeviceToLocationManagers.entity_name, Entities.shareDeviceToLocationManagers.event_name.job, obj, "Job finished.", jobId, companyId)
                    resolve()
                }).catch(err => {
                    updateJob("Failed", jobId)
                    addActivityLog(Entities.shareDeviceToLocationManagers.entity_name, Entities.shareDeviceToLocationManagers.event_name.job, obj, "Job failed.", jobId, companyId)
                    reject(err)
                })
        }
        if (type == 'locationCheckIn') {
            locationCheckInService.manage(obj)
                .then(result => {
                    updateJob("Finished", jobId)
                    addActivityLog(Entities.locationCheckIn.entity_name, Entities.locationCheckIn.event_name.location_checkin, obj, "Job finished.", jobId, companyId)
                    resolve()
                }).catch(err => {
                    updateJob("Failed", jobId)
                    addActivityLog(Entities.locationCheckIn.entity_name, Entities.locationCheckIn.event_name.location_checkin, obj, "Job failed.", jobId, companyId)
                    reject(err)
                })
        }
        if (type == 'locationCheckOut') {
            locationCheckOutService.manage(obj)
                .then(result => {
                    updateJob("Finished", jobId)
                    addActivityLog(Entities.locationCheckOut.entity_name, Entities.locationCheckOut.event_name.location_checkout, obj, "Job finished.", jobId, companyId)
                    resolve()
                }).catch(err => {
                    updateJob("Failed", jobId)
                    addActivityLog(Entities.locationCheckOut.entity_name, Entities.locationCheckOut.event_name.location_checkout, obj, "Job failed.", jobId, companyId)
                    reject(err)
                })
        }
        if (type == 'deleteOccupant') {
            console.log("🚀 ~ file: GenericJobHandler.js:85 ~ obj:", obj)
            deleteOccupantService.manage(obj)
                .then(result => {
                    addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.job, obj, "Job finished.", jobId, companyId)
                    updateJob("Finished", jobId)
                    resolve()
                }).catch(err => {
                    updateJob("Failed", jobId)
                    addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.job, obj, "Job failed.", jobId, companyId)
                    reject(err)
                })
        }
        if (type == 'deleteUser') {
            addActivityLog("UserDeleteJob", "JobInfo", obj, "Job started.", jobId, companyId)
            deleteUserService.manage(obj)
                .then(result => {
                    updateJob("Finished", jobId)
                    addActivityLog(Entities.userDelete.entity_name, Entities.userDelete.event_name.job, obj, "Job finished.", jobId, companyId)
                    resolve()
                }).catch(err => {
                    updateJob("Failed", jobId)
                    addActivityLog(Entities.userDelete.entity_name, Entities.userDelete.event_name.job, obj, "Job failed.", jobId, companyId)
                    reject(err);
                })
        }
        if (type == 'importLocationsJob') {
            addActivityLog(Entities.importLocations.entity_name, Entities.importLocations.event_name.job, obj, "Job started.", jobId, companyId)
            LocationService.manage(obj)
                .then(result => {
                    updateJob("Finished", jobId)
                    addActivityLog(Entities.importLocations.entity_name, Entities.importLocations.event_name.job, obj, "Job finished.", jobId, companyId)
                    resolve()
                }).catch(err => {
                    updateJob("Failed", jobId)
                    addActivityLog(Entities.importLocations.entity_name, Entities.importLocations.event_name.job, obj, "Job failed.", jobId, companyId)
                    reject(err);
                })
        }

        if (type == 'importGatewayLocationsJob') {
            addActivityLog(Entities.importGatewayLocations.entity_name, Entities.importGatewayLocations.event_name.job, obj, "Job started.", jobId, companyId)
            deviceService.linkGatewayLocation(obj)
                .then(result => {
                    updateJob("Finished", jobId)
                    addActivityLog(Entities.importGatewayLocations.entity_name, Entities.importGatewayLocations.event_name.job, obj, "Job finished.", jobId, companyId)
                    resolve()
                }).catch(err => {
                    updateJob("Failed", jobId)
                    addActivityLog(Entities.importGatewayLocations.entity_name, Entities.importGatewayLocations.event_name.job, obj, "Job failed.", jobId, companyId)
                    reject(err);
                })
        }
        if (type == 'deleteDeviceEvents') {
            addActivityLog(Entities.deleteDeviceEvent.entity_name, Entities.deleteDeviceEvent.event_name.job, obj, "Job started.", jobId, companyId)
            deviceService.deleteDeviceEvents(obj)
                .then(result => {
                    updateJob("Finished", jobId)
                    addActivityLog(Entities.deleteDeviceEvent.entity_name, Entities.deleteDeviceEvent.event_name.job, obj, "Job finished.", jobId, companyId)
                    resolve()
                }).catch(err => {
                    updateJob("Failed", jobId)
                    addActivityLog(Entities.deleteDeviceEvent.entity_name, Entities.deleteDeviceEvent.event_name.job, obj, "Job failed.", jobId, companyId)
                    reject(err);
                })
        }
        if (type == 'deleteLocation') {
            addActivityLog(Entities.deleteLocation.entity_name, Entities.deleteLocation.event_name.job, obj, "Job started.", jobId, companyId)
            deleteLocationService.manage(obj)
                .then(result => {
                    updateJob("Finished", jobId)
                    addActivityLog(Entities.deleteLocation.entity_name, Entities.deleteLocation.event_name.job, obj, "Job finished.", jobId, companyId)
                    resolve()
                }).catch(err => {
                    updateJob("Failed", jobId)
                    addActivityLog(Entities.deleteLocation.entity_name, Entities.deleteLocation.event_name.job, obj, "Job failed.", jobId, companyId)
                    reject(err);
                })
        }
        if (type == 'linkDevicesToTheOccupants') {
            addActivityLog(Entities.shareDeviceToOccupants.entity_name, Entities.shareDeviceToOccupants.event_name.job, obj, "Job started.", jobId, companyId)
            linkDevicesToTheOccupantsService.manage(obj)
                .then(result => {
                    updateJob("Finished", jobId)
                    addActivityLog(Entities.shareDeviceToOccupants.entity_name, Entities.shareDeviceToOccupants.event_name.job, obj, "Job finished.", jobId, companyId)
                    resolve()
                }).catch(err => {
                    updateJob("Failed", jobId)
                    addActivityLog(Entities.deleteLocatishareDeviceToOccupantson.entity_name, Entities.shareDeviceToOccupants.event_name.job, obj, "Job failed.", jobId, companyId)
                    reject(err);
                })
        }
        if (type == 'occupantsGatewayDashboardAttributesJob') {
            addActivityLog(Entities.occupantsGatewayDashboardAttributesJob.entity_name, Entities.occupantsGatewayDashboardAttributesJob.event_name.job, obj, "Job started.", jobId, companyId)
            gatewayDashboardAttributesService.manage(obj)
                .then(result => {
                    updateJob("Finished", jobId)
                    addActivityLog(Entities.occupantsGatewayDashboardAttributesJob.entity_name, Entities.occupantsGatewayDashboardAttributesJob.event_name.job, obj, "Job finished.", jobId, companyId)
                    resolve()
                }).catch(err => {
                    updateJob("Failed", jobId)
                    addActivityLog(Entities.occupantsGatewayDashboardAttributesJob.entity_name, Entities.occupantsGatewayDashboardAttributesJob.event_name.job, obj, "Job failed.", jobId, companyId)
                    reject(err);
                })
        }
        if (type == 'DeleteRecordFromDynamoDB') {
            addActivityLog(Entities.occupantsGatewayDashboardAttributesJob.entity_name, Entities.occupantsGatewayDashboardAttributesJob.event_name.job, obj, "Job started.", jobId, companyId)
            deviceService.DeleteRecordFromDynamoDB(obj)
                .then(result => {
                    updateJob("Finished", jobId)
                    addActivityLog(Entities.DeleteRecordFromDynamoDBJob.entity_name, Entities.DeleteRecordFromDynamoDBJob.event_name.job, obj, "Job finished.", jobId, companyId)
                    resolve()
                }).catch(err => {
                    updateJob("Failed", jobId)
                    addActivityLog(Entities.DeleteRecordFromDynamoDBJob.entity_name, Entities.DeleteRecordFromDynamoDBJob.event_name.job, obj, "Job failed.", jobId, companyId)
                    reject(err);
                })
        }
        if (type == 'occupantGatewayDelete') {
            addActivityLog(Entities.occupant_gateway_delete.entity_name, Entities.occupant_gateway_delete.event_name.job, obj, "Job started.", jobId, companyId)
            deleteOccupantGatewayServices.manage(obj)
                .then(result => {
                    // if success true then only update job as finished else update as failed.
                    if (result && (result.success == false)) {
                        updateJob("Failed", jobId)
                        addActivityLog(Entities.occupant_gateway_delete.entity_name, Entities.occupant_gateway_delete.event_name.job, obj, "Job failed.", jobId, companyId)
                    } else {
                        updateJob("Finished", jobId)
                        addActivityLog(Entities.occupant_gateway_delete.entity_name, Entities.occupant_gateway_delete.event_name.job, obj, "Job finished.", jobId, companyId)
                    }
                    resolve();
                }).catch(err => {
                    updateJob("Failed", jobId)
                    addActivityLog(Entities.occupant_gateway_delete.entity_name, Entities.occupant_gateway_delete.event_name.job, obj, "Job failed.", jobId, companyId)
                    reject(err);
                })
        }
    })
}

module.exports = {
    manage
}
