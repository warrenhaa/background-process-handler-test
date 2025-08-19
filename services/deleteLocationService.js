const models = require('../models');
const {
    addActivityLog
} = require('./ActivityLogService')
const AWS = require('aws-sdk');
const Logger = require('../Logger');
const {
    Entities
} = require('../utils/Entities');
const {
    Constant
} = require('../Constants')
const shareDeviceToLocationManagerService = require('../services/ShareDeviceToLocationManagerService');
const {
    createJob,
    updateJob
} = require('../services/JobsService')
const {
    sleep
} = require('../Helper')

async function getLocation(id) {
    return new Promise(async (resolve, reject) => {
        const location = await models.locations.findOne({
            include: [{
                model: models.location_types,
                required: true,
                as: 'location_type',
            },
            {
                model: models.addresses,
                as: 'address',
            },
            ],
            where: {
                id
            },
            raw: true,
            nest: true,
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        });
    })
}

async function createJobForDeviceProvision(input, companyId, userId, userId, metadata, job) {
    return new Promise(async (resolve, reject) => {
        let obj = {input, companyId};
         createJob('deviceLocationAssignment', 'Started', input, companyId, userId, userId, metadata).then(async (result) => {
             const jobId = result.id
             obj.jobId = jobId
                    addActivityLog(Entities.deleteLocation.entity_name, Entities.deleteLocation.event_name.ShareDeviceToLocationManagersJob, obj, `ShareDeviceToLocationManagersJob Started`, job, companyId)
                     shareDeviceToLocationManagerService.deviceLocationAssignment(obj)
                        .then(result => {
                            updateJob("Finished", jobId)
                            addActivityLog(Entities.deleteLocation.entity_name, Entities.deleteLocation.event_name.ShareDeviceToLocationManagersJob, obj, `ShareDeviceToLocationManagersJob finished Successfully`, job, companyId)
                            resolve(result)
                        }).catch(err => {
                            addActivityLog(Entities.deleteLocation.entity_name, Entities.deleteLocation.event_name.ShareDeviceToLocationManagersJob, obj, `ShareDeviceToLocationManagersJob failed`, job, companyId)
                            reject(err)
                        })
                }).catch(err => {
                    addActivityLog(Entities.deleteLocation.entity_name, Entities.deleteLocation.event_name.ShareDeviceToLocationManagersJob, obj, err.message, job, companyId)
                    reject(err)

                })
    })
}

async function unlinkGatewayLocation(companyId, userId, gatewayIdList, location_id, adminData, job) {
    return new Promise(async (resolve, reject) => {
        let count = 0
        if (gatewayIdList.length > 0) {
            for (let gatewayId of gatewayIdList) {
                const id = gatewayId;
                let locationId = null;
                const before_location = location_id;
                let oldLocation = {};
                let get_connected_device = [];
                const gatewayDevice = await models.devices.findOne({
                    where: {
                        id
                    },
                    raw: true
                });
                // finding all connected devices to the gatewayId
                get_connected_device = await models.devices.findAll({
                    where: {
                        gateway_id: id
                    },
                    include: [{
                        required: false,
                        model: models.locations,
                        as: 'locations',
                        include: [{
                            required: false,
                            model: models.location_types,
                            as: 'location_type',
                        }, ],
                    }, ],
                    raw: true,
                    nest: true,
                });

                const currentLocation = await getLocation(before_location);
                if (currentLocation.location_type.name !== 'site') {
                    const {
                        path
                    } = currentLocation;
                    for (const key of Object.keys(path)) {
                        if (typeof path[key] === 'object' && path[key].hasOwnProperty('site')) {
                            locationId = key;
                            break;
                        }
                    }
                }

                // call to deviceProvision logic - start
                let key = 'constants'
            let constants = await Constant(key)
                let role = currentLocation.location_type.name !== 'site' ? constants.ROLES.site : null;
                let inputDetails = await getProvisionDetails(before_location, role, constants.DeviceProvision.REMOVE_SHARE_DEVICE_BY_OWNER, companyId);
                let metadata = {
                    before_location,
                    deviceCode: gatewayDevice.device_code,
                    percentage: 0
                }
                const input = {
                    ...inputDetails,
                    accessToken: adminData.accessToken,
                    adminIdentityId: adminData.identityId,
                    deviceCode: gatewayDevice.device_code,
                    deviceType: gatewayDevice.type,
                    metadata,
                };
                await createJobForDeviceProvision( input, companyId, userId, userId, metadata, job)

                for (let d of get_connected_device) {
                    if (d?.locations?.location_type?.name !== 'site') {
                        role = constants.ROLES.site;
                        inputDetails = await getProvisionDetails(d?.locations?.id, role, constants.DeviceProvision.REMOVE_SHARE_DEVICE_BY_OWNER, companyId);
                        let metadata = {
                            location_id: d?.locations?.id,
                            deviceCode: d.device_code,
                            percentage: 0
                        }
                        const input = {
                            ...inputDetails,
                            accessToken: adminData.accessToken,
                            adminIdentityId: adminData.identityId,
                            deviceCode: d.device_code,
                            deviceType: d.type,
                            metadata,
                        };
                        await createJobForDeviceProvision( input, companyId, userId, userId, metadata, job)
                    }
                }
                // call to deviceProvision logic - end

                const updateFields = {
                    location_id: locationId,
                    id,
                    updated_by: userId,
                    updated_at: new Date(),
                };
                const queryStr = 'UPDATE devices SET location_id= :location_id,updated_by= :updated_by,updated_at= :updated_at where id = :id OR gateway_id = :id';
                const [results, md] = await models.sequelize.query(queryStr, {
                    raw: true,
                    replacements: updateFields,
                    logging: console.log,
                });
                const updatedDeviceData = await models.devices.findOne({
                    where: {
                        id
                    }
                });
                const updatedLocation = await getLocation(updatedDeviceData.location_id);
                const unlink_obj = {
                    old: gatewayDevice,
                    new: {},
                };
                if (before_location && before_location != null) {
                    Unlinked = Entities.locations.event_name.gateway_unlinked;
                    addActivityLog(Entities.locations.entity_name, Unlinked,
                        unlink_obj, Entities.notes.event_name.updated, currentLocation.id, companyId, userId, null);
                }
                if (before_location) {
                    oldLocation = currentLocation;
                } else {
                    oldLocation = {};
                }
                const link_obj = {
                    old: {},
                    new: updatedDeviceData,
                };
                if (locationId && JSON.stringify(locationId) != JSON.stringify(before_location)) {
                    Linked = Entities.locations.event_name.gateway_linked;
                    addActivityLog(Entities.locations.entity_name, Linked,
                        link_obj, Entities.notes.event_name.updated, locationId, companyId, userId, null);
                }
                const device_obj = {
                    old: oldLocation,
                    new: updatedLocation,
                };
                // link and unlink all the gateway connected devices //unlink activitylog for all devices
                get_connected_device.forEach(async (element) => {
                    const unlink_gateways_location_obj = {
                        old: element,
                        new: {},
                    };
                    if (before_location && JSON.stringify(locationId) != JSON.stringify(before_location)) {
                        Unlinked = Entities.locations.event_name.device_unlinked;
                        addActivityLog(Entities.locations.entity_name, Unlinked,
                            unlink_gateways_location_obj, Entities.notes.event_name.updated, before_location, companyId, userId, null);
                    }
                    const new_connected_gateways_devices = await models.devices.findOne({
                        where: {
                            id: element.id,
                        },
                        raw: true,
                    });
                    const link_gateways_location_obj = {
                        old: {},
                        new: new_connected_gateways_devices,
                    };
                    if (locationId && JSON.stringify(locationId) != JSON.stringify(before_location)) {
                        Linked = Entities.locations.event_name.device_linked;
                        addActivityLog(Entities.locations.entity_name, Linked,
                            link_gateways_location_obj, Entities.notes.event_name.updated, locationId, companyId, userId, null);
                    }
                    if (locationId && JSON.stringify(locationId) != JSON.stringify(before_location)) {
                        addActivityLog(Entities.devices.entity_name, Entities.locations.event_name.updated,
                            device_obj, Entities.notes.event_name.updated, new_connected_gateways_devices.id, companyId, userId, null);
                    }
                }); // finished foreach loop
                if (JSON.stringify(updatedDeviceData.location_id) != JSON.stringify(before_location)) {

                    addActivityLog(Entities.devices.entity_name, Entities.locations.event_name.updated,
                        device_obj, Entities.notes.event_name.updated, updatedDeviceData.id, companyId, userId, null);
                }


                count = count + 1
                if (count == gatewayIdList.length) {
                    resolve(updatedDeviceData)
                }
            }
        } else {
            if (count == gatewayIdList.length) {
                resolve()
            }
        }
    })
}

async function unlinkDeviceLocation(devicesList, companyId, userId, adminData, job) {
    return new Promise(async (resolve, reject) => {
        let count = 0
        if (devicesList.length > 0) {
            let key = 'constants'
            let constants = await Constant(key)
            for (let device of devicesList) {
                const locationId = device.location_id;
                let oldLocation = {};
                const getDevice = await models.devices.findOne({
                    where: {
                        id: device.id
                    },
                    raw: true,
                });
                const prior_locationId = getDevice.location_id;
                const getLocationData = await getLocation(prior_locationId);
                const unlink_obj = {
                    old: getDevice,
                    new: {},
                };
                if (prior_locationId && JSON.stringify(prior_locationId) !== JSON.stringify(locationId)) {
                    // call deviceProvision api - start
                    const currLoc = await getLocation(locationId);
                    if (!currLoc || currLoc.location_type.name === 'site') { // check if new location is different then building/area. because we only need to unshare if device it is being moved from building/area to site/none
                        let role = currLoc.location_type.name === 'site' ? constants.ROLES.site : null;
                        let inputDetails = await getProvisionDetails(prior_locationId, role, constants.DeviceProvision.REMOVE_SHARE_DEVICE_BY_OWNER, companyId);
                        const metadata = {
                            locationId,
                            deviceCode: getDevice.device_code,
                            percentage: 0
                        }
                        const input = {
                            ...inputDetails,
                            accessToken: adminData.accessToken,
                            adminIdentityId: adminData.identityId,
                            deviceCode: getDevice.device_code,
                            deviceType: getDevice.type,
                            metadata,
                        };
                        
                        await createJobForDeviceProvision(input, companyId, userId, userId, metadata, job)
                    }
                    // call deviceProvision api - end

                    let Unlinked = Entities.locations.event_name.device_unlinked;
                    addActivityLog(Entities.locations.entity_name, Unlinked,
                        unlink_obj, Entities.notes.event_name.updated, getLocationData.id, device.company_id, req.user_id, null);
                }
                const updateDevice = await models.devices.update(device, {
                    where: {
                        id: device.id
                    },
                    returning: true,
                    plain: true,
                }).then(async () => {
                    const updatedDevice = await models.devices.findOne({
                        include: [{
                                required: false,
                                model: models.locations,
                                as: 'locations',
                            },
                            {
                                required: false,
                                model: models.devices,
                                as: 'gateway',
                            },
                        ],
                        where: {
                            id: device.id
                        },
                    });
                    if (prior_locationId) {
                        oldLocation = getLocationData;
                    } else {
                        oldLocation = {};
                    }
                    const link_obj = {
                        old: {},
                        new: updatedDevice,
                    };
                    if (JSON.stringify(locationId) !== JSON.stringify(prior_locationId)) {
                        let Linked = Entities.locations.event_name.device_linked;
                        addActivityLog(Entities.locations.entity_name, Linked,
                            link_obj, Entities.notes.event_name.updated, updatedDevice.location_id, device.company_id, req.user_id, null);
                    }
                    const updated_obj = {
                        old: oldLocation,
                        new: updatedDevice.locations,
                    };
                    if (JSON.stringify(locationId) !== JSON.stringify(prior_locationId)) {
                        addActivityLog(Entities.devices.entity_name, Entities.locations.event_name.updated,
                            updated_obj, Entities.notes.event_name.updated, updatedDevice.id, device.company_id, req.user_id, null);
                    }
                    return updatedDevice;
                }).catch(() => {

                });
                count = count + 1
                if (count == devicesList.length) {
                    resolve(updateDevice);
                }
            }
        } else {
            if (count == devicesList.length) {
                resolve()
            }
        }
    })
}
async function getProvisionDetails(locationId, role, command, companyId) {
    return new Promise(async (resolve, reject) => {
        //role :- will skip the users whos role matched with param role
        const currentLocation = await getLocation(locationId);
        if (!currentLocation) {
            Logger.error(`getProvisionDetails location not found with id  ${locationId}`);
        }
        let key = 'constants'
            let constants = await Constant(key)
        let locationsIds = Object.keys(currentLocation.path)
            .map((key) => {
                if (key !== 'breadcrumb') {
                    return key;
                }
            }).filter((item) => item);
        locationsIds = [...locationsIds, locationId]
        //1. get locationManagers list by locationId
        const queryUsersList = `SELECT DISTINCT u.email,u.id,u.name,u.identity_id,lp.role FROM users u 
    INNER JOIN locations_permissions lp ON lp.user_id = u.id
    WHERE lp.location_id IN (:locationIds)`;
        let usersList = []
        usersList = await models.sequelize.query(queryUsersList, {
            raw: true,
            replacements: {
                locationIds: locationsIds,
            },
            logging: console.log,
            model: models.devices,
        });
        if (role && usersList.length > 0) {
            usersList = usersList.map(u => {
                if (u.role !== role) return u;
            }).filter(a => a);
        }
        let lockUnlockCommand = -1;
        if (command === constants.DeviceProvision.SHARE_DEVICE_BY_OWNER) {
            lockUnlockCommand = constants.DeviceProvision.ADMIN_LOCK_OWNER_OF_DEVICE;
        } else if (command === constants.DeviceProvision.REMOVE_SHARE_DEVICE_BY_OWNER) {
            lockUnlockCommand = constants.DeviceProvision.ADMIN_UNLOCK_OWNER_OF_DEVICE;
        } else {
            Logger.error(` getProvisionDetails Error command not valid ${command} ${userid}`);
        }
        const input = {
            usersList,
            command,
            lockUnlockCommand,
        };
        resolve(input)

    })
}
async function deleteChildLocation(data, companyId, jobId) {
    return new Promise(async (resolve, reject) => {
        const locationId = data.id;
        const typeName = data['location_types.name'];
        const query = {};
        const key = `path.${locationId}.${typeName}`;
        query[key] = data.name;
        // get the list of the child locations
        const childLocations = await models.locations.findAll({
            where: query,
            raw: true
        }).catch(error => {
            reject(error)
        });
        if (childLocations.length > 0) {
            for (let location of childLocations) {
                // check linked deviceor gateway for given location_id
                const find_linkedDevices = await models.devices.findAll({
                    where: {
                        location_id: location.id
                    },
                })
                if (find_linkedDevices.length > 0) {
                    // if device or gateway is linked to the location_id then update the location_id as null
                    const linkedDevices = await models.devices
                        .update({
                            location_id: null,
                        }, {
                            where: {
                                location_id: location.id
                            },
                            returning: true,
                        }).then((result) => {
                            let devices = null;
                            if (result[1] && result[1].length > 0) {
                                const models = result[1];
                                devices = models.map((model) => model.dataValues);
                                return devices;
                            }
                        });
                    const unlinked_device_obj = {
                        old: childLocations,
                        new: {}
                    };
                    // add activity_log for each device or gateway
                    for (let element of find_linkedDevices) {
                        if (element.location_id !== linkedDevices.location_id) {
                            if (element.type === 'gateway') {
                                addActivityLog(Entities.devices.entity_name, Entities.devices.event_name.location_updated, unlinked_device_obj, 'Existing Record Updated', element.id, companyId)
                            } else {
                                addActivityLog(Entities.devices.entity_name, Entities.devices.event_name.location_updated, unlinked_device_obj, 'Existing Record Updated', element.id, companyId)
                            }
                            addActivityLog(Entities.deleteLocation.entity_name, Entities.deleteLocation.event_name.location_unlinked, unlinked_device_obj, 'Location Unlinked Successfully', jobId, companyId)
                        };
                    }
                }
                // delete the child location 
                await models.locations.destroy({
                    where: {
                        id: location.id
                    },
                }).then(result => {
                    addActivityLog(Entities.locations.entity_name, Entities.locations.event_name.removed, location, 'Child Location Deleted Successfully', location.container_id, companyId)
                    addActivityLog(Entities.deleteLocation.entity_name, Entities.deleteLocation.event_name.removed, location, `Child Location Deleted Successfully`, jobId, companyId)
                    resolve(result);
                }).catch(error => {
                    reject(error);
                });
            };
        } else {
            addActivityLog(Entities.deleteLocation.entity_name, Entities.deleteLocation.event_name.job, data, `Child Location not found`, jobId, companyId)
            resolve()
        }

    })
}
const manage = function(obj) {
    return new Promise(async (resolve, reject) => {
        const userId = obj.input.userId;
        const jobId = obj.jobId;
        const companyId = obj.companyId
        const location = JSON.parse(obj.input.locationData);
        const location_id = obj.input.location_id;
        const adminData = obj.input.adminData
        const queryDevicesList = `SELECT d.* FROM devices d WHERE d.location_id IN ( SELECT id FROM locations WHERE id IN (:locationIds) OR path ? :locationIds )`;
        let devicesList = [];
        devicesList = await models.sequelize.query(queryDevicesList, {
            raw: true,
            replacements: {
                locationIds: [location_id],
            },
            logging: console.log,
            model: models.devices,
        });
        //remove devices whose gateway present in the list as we donot need to share devices separately.
        const gatewayIdList = devicesList.map(d => (d.type === 'gateway' && d.id)).filter(a => a);
        devicesList = await devicesList.map(d => {
            return (d.gateway_id && d.type !== 'gateway' && !gatewayIdList.includes(d.gateway_id) && d)
        }).filter(a => a);
        if (gatewayIdList && gatewayIdList.length > 0) {
            await unlinkGatewayLocation(companyId, userId, gatewayIdList, location_id, adminData, jobId);
        }
        if (devicesList && devicesList.length > 0) {
            await unlinkDeviceLocation(devicesList, companyId, userId, adminData, jobId);
        }
        await sleep(5000)
        // delete the location 
        await models.locations.destroy({
            where: {
                id: location_id
            },
        }).then(async (result) => {
            // function for delete the child location
            await deleteChildLocation(location, companyId, jobId).catch(error => {
                addActivityLog(Entities.deleteLocation.entity_name, Entities.deleteLocation.event_name.job, location, error.msg, jobId, companyId);
            });
            const locationObj = {
                old: location,
                new: {}
            };
            addActivityLog(Entities.locations.entity_name, Entities.locations.event_name.deleted, locationObj, 'Location Deleted Successfully', location_id, companyId)
            addActivityLog(Entities.deleteLocation.entity_name, Entities.deleteLocation.event_name.deleted, locationObj, `Location Deleted Successfully`, jobId, companyId)
            resolve(result)
        }).catch(err => {
            reject(err)
            addActivityLog(Entities.deleteLocation.entity_name, Entities.deleteLocation.event_name.job, location, err.message, jobId, companyId);
        })
    });
}
module.exports = {
    manage
}