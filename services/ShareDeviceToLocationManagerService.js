const {
	addActivityLog
} = require('./ActivityLogService')
const {
	deviceProvison
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

const deviceLocationAssignment = function (obj) {
	return new Promise(async (resolve, reject) => {
		let { accessToken, adminIdentityId, deviceCode, deviceType, command, lockUnlockCommand, usersList, metadata } = obj.input
		const jobId = obj.jobId
		const companyId = obj.companyId
		addActivityLog(Entities.shareDeviceToLocationManagers.entity_name, Entities.shareDeviceToLocationManagers.event_name.job, {
			usersList,
			command,
			lockUnlockCommand,
			deviceCode,
		}, "deviceLocationAssignment - started device provisioning.", jobId, companyId)
		let count = 0
		let percentage = 0
		let key = 'constants'
        let constants = await Constant(key);
		let cmdStr = command === constants.DeviceProvision.SHARE_DEVICE_BY_OWNER
			? Entities.shareDeviceToLocationManagers.event_name.shareDevice : Entities.shareDeviceToLocationManagers.event_name.unShareDevice
		let lkcmdStr = lockUnlockCommand === constants.DeviceProvision.ADMIN_LOCK_OWNER_OF_DEVICE
			? Entities.shareDeviceToLocationManagers.event_name.lockDevice : Entities.shareDeviceToLocationManagers.event_name.unLockDevice

		if(usersList && usersList.length<=0){
			addActivityLog(Entities.shareDeviceToLocationManagers.entity_name, cmdStr, {
				deviceCode,
				command,
				lockUnlockCommand,
			}, `deviceLocationAssignment - No users found to share/unshare Device`, jobId, companyId)
			percentage = 100;
			metadata = {...metadata,percentage}
			await updateJobWithMetaData("In-Progress",metadata,jobId);
		}
		else{
			for (let user of usersList) {
				await updateSharerList(accessToken,adminIdentityId,user.email,deviceCode,command)
				.then(async (result)=>{
					addActivityLog(Entities.shareDeviceToLocationManagers.entity_name, cmdStr, {
						userEmail : user.email,
						deviceCode,
						command,
					}, `deviceLocationAssignment - ${cmdStr} Done`, jobId, companyId)
					if(deviceType==='gateway'){// lock-unlock if device is gateway
						await updateSharerList(accessToken,adminIdentityId,user.email,deviceCode,lockUnlockCommand)
						.then(async (result)=>{
							addActivityLog(Entities.shareDeviceToLocationManagers.entity_name, lkcmdStr, {
								userEmail : user.email,
								deviceCode,
								lockUnlockCommand,
							}, `deviceLocationAssignment - user ${lkcmdStr} Done`, jobId, companyId)
						})
						.catch(e=> {
							addActivityLog(Entities.shareDeviceToLocationManagers.entity_name, lkcmdStr, {
								deviceCode,
								userEmail: user.email,
								lockUnlockCommand,
							}, `deviceLocationAssignment - user ${lkcmdStr} error, ${e.message}`, jobId, companyId)
						})
					}
				})
				.catch(error => {
					addActivityLog(Entities.shareDeviceToLocationManagers.entity_name, cmdStr, {
						userEmail : user.email,
						deviceCode,
						command,
					}, `deviceLocationAssignment - ${cmdStr} error, ${error.message}`, jobId, companyId)
				})
				count++;
				percentage = (100 * count) / usersList.length
				metadata = {...metadata,percentage}
				await updateJobWithMetaData("In-Progress",metadata,jobId)
			}
		}
		resolve()
	})
}

const userLocationAssignment = function (obj) {
	return new Promise(async (resolve, reject) => {
		let { accessToken,adminIdentityId,email,devicesList,command,lockUnlockCommand,metadata } = obj.input
		const jobId = obj.jobId
		const companyId = obj.companyId
		addActivityLog(Entities.shareDeviceToLocationManagers.entity_name, Entities.shareDeviceToLocationManagers.event_name.job, {
			devicesList,
			command,
			lockUnlockCommand,
			email,
		}, "userLocationAssignment - started device provisioning.", jobId, companyId)
		let count = 0
		let percentage = 0
		let key = 'constants'
        let constants = await Constant(key);
		let cmdStr = command === constants.DeviceProvision.SHARE_DEVICE_BY_OWNER
			? Entities.shareDeviceToLocationManagers.event_name.shareDevice : Entities.shareDeviceToLocationManagers.event_name.unShareDevice
		let lkcmdStr = lockUnlockCommand === constants.DeviceProvision.ADMIN_LOCK_OWNER_OF_DEVICE
			? Entities.shareDeviceToLocationManagers.event_name.lockDevice : Entities.shareDeviceToLocationManagers.event_name.unLockDevice
		if(devicesList && devicesList.length<=0){
			addActivityLog(Entities.shareDeviceToLocationManagers.entity_name, cmdStr, {
				userEmail: email,
				command,
				lockUnlockCommand,
			}, `userLocationAssignment - No Devices to share/unshare`, jobId, companyId)
			percentage = 100;
			metadata = {...metadata,percentage}
			await updateJobWithMetaData("In-Progress",metadata,jobId);
		}
		else{
			for (let device of devicesList) {
				await updateSharerList(accessToken,adminIdentityId,email,device.device_code,command)
				.then(async (result) => {
					addActivityLog(Entities.shareDeviceToLocationManagers.entity_name, cmdStr, {
						device_code: device.device_code,
						userEmail: email,
						command,
					}, `userLocationAssignment -  ${cmdStr} Done`, jobId, companyId)
					if(device.type==='gateway'){ // lock-unlock if device is gateway
						await updateSharerList(accessToken,adminIdentityId,email,device.device_code,lockUnlockCommand)
						.then(async (result) => {
							addActivityLog(Entities.shareDeviceToLocationManagers.entity_name, lkcmdStr, {
								userEmail: email,
								device_code: device.device_code,
								lockUnlockCommand,
							}, `userLocationAssignment - user ${lkcmdStr} Done`, jobId, companyId)
						}).catch(e=> {
							addActivityLog(Entities.shareDeviceToLocationManagers.entity_name, lkcmdStr, {
								device_code:device.device_code,
								userEmail: email,
								lockUnlockCommand
							}, `userLocationAssignment - user ${lkcmdStr} error, ${e.message}`, jobId, companyId)
						})
					}
				}).catch(error => {
					addActivityLog(Entities.shareDeviceToLocationManagers.entity_name, cmdStr, {
						device_code:device.device_code,
						userEmail: email,
						command
					}, `userLocationAssignment - ${cmdStr} error, ${error.message}`, jobId, companyId)
				})
				count++;
				percentage = (100 * count) / devicesList.length
				metadata = {...metadata,percentage}
				await updateJobWithMetaData("In-Progress",metadata,jobId);
			}
		}
		resolve()
	})
}

module.exports = {
	deviceLocationAssignment, userLocationAssignment
}