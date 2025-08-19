const models = require('../models');
const { addActivityLog } = require('./ActivityLogService');
const { Entities } = require('../utils/Entities');
const { sleep } = require('../Helper')
let Logger = require('../Logger')
const CommunicateWithAwsIotService = require('./CommunicateWithAwsIotService');

var getCoordinatorDeviceFromThingGroup = function (device_code, company_id, count, occupant_id, gateway_id, jobId) {
  return new Promise(async (resolve, reject) => {
    var params = {
      thingName: device_code, /* required */
    };
    // console.log("🚀 ~ returnnewPromise ~ params: getCoordinatorDeviceFromThingGroup 13", params)
    // add code here for check shadow
    addActivityLog(Entities.occupant_gateway_delete.entity_name, Entities.occupant_gateway_delete.event_name.job, { device_code }, "Finding Coordinator Device Shadow", jobId, company_id)

    const getShadowData = await CommunicateWithAwsIotService.communicateWithAwsIot(params, company_id, 'getThingShadow')
      .then((data) => data).catch(err => { reject(err); });
    if (getShadowData) {
      addActivityLog(Entities.occupant_gateway_delete.entity_name, Entities.occupant_gateway_delete.event_name.job, { device_code }, "Coordinator Device Shadow Exists", jobId, company_id)

      if (count <= 200) { // kept check for coordinator device shadow for 1000 count
        await sleep(5000)
        count = count + 1
        addActivityLog(Entities.occupant_gateway_delete.entity_name, Entities.occupant_gateway_delete.event_name.job, { device_code }, "Calling coordinator device shadow function by increaing count", jobId, company_id)
        var data = await getCoordinatorDeviceFromThingGroup(device_code, company_id, count, occupant_id, gateway_id, jobId)
          .catch(err => { reject(err) });
        resolve(data);
      } else {
        addActivityLog(Entities.occupant_gateway_delete.entity_name, Entities.occupant_gateway_delete.event_name.job, { device_code }, "Count limit exceeds success false", jobId, company_id)
        // Logger.error("OccupantGatewayDeleteError", { "msg": "Count limit exceeds, Job Failed", params });
        // Creating a new Error object with a descriptive message
        // const error = new Error("Job Failed. Count limit exceeded, Gateway not deleted please try again");

        // resolving the Promise with the error description mesaage
        resolve({ success: false, message: "Job Failed. Count limit exceeded, Gateway not deleted please try again" });

      }
    } else {
      addActivityLog(Entities.occupant_gateway_delete.entity_name, Entities.occupant_gateway_delete.event_name.job, { device_code }, "Coordinator Device Shadow Deleted, Success", jobId, company_id)
      // delete occupants permissions 
      await models.occupants_permissions.destroy(
        {
          where: { gateway_id: gateway_id }
        }).then((result) => {
          resolve(result)
        }).catch(err => {
          reject(err)
        })
      resolve({ success: true });
    }
  })
}


var manage = function (obj) {
  return new Promise(async (resolve, reject) => {
    // console.log("OccupantGatewayDeleteJob Input", obj);
    const gateway_id = obj.input.gatewayId;
    const occupantEmail = obj.input.occupantEmail;
    const occupant_id = obj.input.occupantId;
    const company_id = obj.input.companyId || obj.companyId;
    const device_code = obj.input.deviceCode;
    const jobId = obj.jobId;
    addActivityLog(Entities.occupant_gateway_delete.entity_name, Entities.occupant_gateway_delete.event_name.job, obj, "Finding coordinator device exists", jobId, company_id)
    var gatewayCoordinatorDeviceExists = await models.devices.findOne({
      where: { gateway_id: gateway_id, type: 'coordinator_device' },
    }).catch(err => {
      console.log("OccupantGatewayDeleteJob Error, error while finding coordinator device", err);
      addActivityLog(Entities.occupant_gateway_delete.entity_name, Entities.occupant_gateway_delete.event_name.job, obj, "Error while finding coordinator device", jobId, company_id)
      reject(err)
    });

    if (gatewayCoordinatorDeviceExists && Object.keys(gatewayCoordinatorDeviceExists).length >= 1) {
      const coordinatorDeviceCode = gatewayCoordinatorDeviceExists.device_code;
      // get the coordinator device shadow
      addActivityLog(Entities.occupant_gateway_delete.entity_name, Entities.occupant_gateway_delete.event_name.job, obj, "Calling coordinator device shadow function", jobId, company_id)
      var getCoordinatorDeviceShadow = await getCoordinatorDeviceFromThingGroup(coordinatorDeviceCode, company_id, 0, occupant_id, gateway_id, jobId)
        .catch(err => { reject(err) });
      addActivityLog(Entities.occupant_gateway_delete.entity_name, Entities.occupant_gateway_delete.event_name.job, obj, "Returning result", jobId, company_id)
      resolve({ jobId: jobId, success: (getCoordinatorDeviceShadow.success) ? getCoordinatorDeviceShadow.success : true });
    } // end of if coordinator present
    resolve()
  })
}

module.exports = {
  manage
}