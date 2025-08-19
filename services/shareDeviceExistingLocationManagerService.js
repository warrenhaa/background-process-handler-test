const {
	addActivityLog
} = require('./ActivityLogService')
const models = require('../models');
const {
	deviceProvison,
    adminSetup
} = require('./deviceProvisionService')
const {
	Entities
} = require('../utils/Entities')
const {
	Constant
} = require('../Constants')
const {
	updateJobWithMetaData
} = require('../services/JobsService')


function removeUserFromAdminSalus(accessToken,userEmail) {
    return new Promise(async(resolve, reject) => {
        const headerParams = {
            Authorization: accessToken
        };
        let key = 'constants'
        let constants = await Constant(key);
        const formObj = {
            Username: userEmail,
            Command: constants.AdminSetup.REMOVE_USER_FROM_ADMIN_GROUP,
        };
        adminSetup(headerParams, formObj, 0)
        .then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
} 

function updateSharerList(accessToken, adminIdentityId, userEmail, deviceCode, command) {
	return new Promise((resolve, reject) => {
		const headerParams = {
			Authorization: accessToken
		};
		const formObj = {
			UserID: adminIdentityId,
			Username: userEmail,
			Command: command,
			DeviceID: deviceCode
		};
		deviceProvison(headerParams, formObj, 0)
			.then(result => {
				resolve(result)
			}).catch(err => {
				reject(err)
			})
	})
}

function getUserDevices(user_id,company_id) {
    return new Promise(async (resolve, reject) => {
        const locationsPermissions = await models.locations_permissions.findAll({
            where: { user_id, company_id },
            raw: true
        })
        const locationIds = locationsPermissions.map(obj=> obj.location_id);
        let devicesList = [];
        devicesList = await models.devices.findAll({
            where: {
                location_id:locationIds
            },
            raw: true
        });
        //remove devices whose gateway present in the list as we donot need to share devices separately.
        const gatewayIdList = await devicesList.map(d=> (d.type==='gateway' && d.id) ).filter(a=>a);
        devicesList = await devicesList.map(d=>{
        return ((!d.gateway_id || !gatewayIdList.includes(d.gateway_id)) && d)
        }).filter(a=>a);
        resolve(devicesList)
    })
}


const manage = function(obj) {
    return new Promise(async (resolve, reject) => {
        let { accessToken, adminIdentityId, command, lockUnlockCommand, usersList, metadata } = obj.input
        const jobId = obj.jobId
		const companyId = obj.companyId
        addActivityLog(Entities.shareDeviceToLocationManagers.entity_name, Entities.shareDeviceToLocationManagers.event_name.job, {
			usersList,
			command,
			lockUnlockCommand,
		}, "shareDeviceExistingLocationManagers - started device provisioning.", jobId, companyId)
        let count = 0
		let percentage = 0
        if(usersList && usersList.length<=0){
			addActivityLog(Entities.shareDeviceExistingLocationManagers.entity_name, Entities.shareDeviceExistingLocationManagers.event_name.shareDevice, {
				usersList,
			}, `shareDeviceExistingLocationManagers - usersList is empty`, jobId, companyId)
			percentage = 100;
			metadata = {...metadata,percentage}
			await updateJobWithMetaData("In-Progress",metadata,jobId);
		}
        else{
            for(let user of usersList) {
                await removeUserFromAdminSalus(accessToken,user.email).then(res=>{
                    addActivityLog(Entities.shareDeviceExistingLocationManagers.entity_name, Entities.shareDeviceExistingLocationManagers.event_name.removeAdmin, {
                        userEmail : user.email,
                        response : res.data.body,
                        status: res.data.statusCode
                    }, `shareDeviceExistingLocationManagers - AdminSetup`, jobId, companyId)
                }).catch(error=>{
                    addActivityLog(Entities.shareDeviceExistingLocationManagers.entity_name, Entities.shareDeviceExistingLocationManagers.event_name.removeAdmin, {
                        userEmail : user.email,
                    }, `shareDeviceExistingLocationManagers - AdminSetup Error, ${error.message}`, jobId, companyId)
                });
                await getUserDevices(user.id,companyId)
                    .then(async (devicesList) => {
                    addActivityLog(Entities.shareDeviceExistingLocationManagers.entity_name, Entities.shareDeviceExistingLocationManagers.event_name.locationDevices, {
                        userEmail : user.email,
                        devicesList,
                    }, `shareDeviceExistingLocationManagers - User Devices List`, jobId, companyId)
                        
                        for(let device of devicesList) {
                            await updateSharerList(accessToken,adminIdentityId,user.email,device.device_code,command)
                            .then(async (result)=>{
                                addActivityLog(Entities.shareDeviceExistingLocationManagers.entity_name, Entities.shareDeviceExistingLocationManagers.event_name.shareDevice, {
                                    userEmail : user.email,
                                    deviceCode: device.device_code,
                                }, `shareDeviceExistingLocationManagers - share device Done`, jobId, companyId)
                                if(device.type==='gateway'){// lock-unlock if device is gateway
                                    await updateSharerList(accessToken,adminIdentityId,user.email,device.device_code,lockUnlockCommand)
                                    .then(async (result)=>{
                                        addActivityLog(Entities.shareDeviceExistingLocationManagers.entity_name, Entities.shareDeviceExistingLocationManagers.event_name.lockDevice, {
                                            userEmail : user.email,
                                            deviceCode : device.device_code,
                                        }, `shareDeviceExistingLocationManagers - user lock Done`, jobId, companyId)
                                    })
                                    .catch(e=> {
                                        addActivityLog(Entities.shareDeviceExistingLocationManagers.entity_name, Entities.shareDeviceExistingLocationManagers.event_name.lockDevice, {
                                            deviceCode: device.device_code,
                                            userEmail: user.email
                                        }, `shareDeviceExistingLocationManagers - user lock error, ${e.message}`, jobId, companyId)
                                    })
                                }
                            })
                            .catch(error => {
                                addActivityLog(Entities.shareDeviceExistingLocationManagers.entity_name, Entities.shareDeviceExistingLocationManagers.event_name.shareDevice, {
                                    userEmail : user.email,
                                    deviceCode: device.device_code,
                                    }, `shareDeviceExistingLocationManagers - share device error, ${error.message}`, jobId, companyId)
                            })
                        }
                    })
                    .catch(err=>{
                        addActivityLog(Entities.shareDeviceExistingLocationManagers.entity_name, Entities.shareDeviceExistingLocationManagers.event_name.locationDevices, {
                        }, `shareDeviceExistingLocationManagers - share device error, ${err.message}`, jobId, companyId)
                    })
                count++;
                percentage = (100 * count) / usersList.length
                metadata = {...metadata,percentage}
                await updateJobWithMetaData("In-Progress",metadata,jobId);
            }
        }
        resolve()
    })
}

module.exports = {
    manage
}