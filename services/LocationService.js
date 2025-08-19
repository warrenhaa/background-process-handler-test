const models = require('../models');
const lodash = require('lodash');
const {
    addActivityLog
} = require('./ActivityLogService');
const {
    Constant
} = require('../Constants')
const {
    Entities
} = require('../utils/Entities')

function createAddress(AdressValues) {
    return new Promise(async (resolve, reject) => {
        await models.addresses.create({
            line_1: AdressValues.line_1,
            line_2: AdressValues.line_2,
            line_3: AdressValues.line_3,
            city: AdressValues.city,
            state: AdressValues.state,
            country: AdressValues.country,
            zip_code: AdressValues.zip_code,
            geo_location: AdressValues.geo_location,
            total_area: AdressValues.total_area,
            company_id: AdressValues.company_id,
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

function getAddress(id) {
    return new Promise(async (resolve, reject) => {
        await models.addresses.findOne({
            where: {
                id
            }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

function createLocations(LocationValues, jobId, companyId) {
    return new Promise(async (resolve, reject) => {
        let path = {};
        let newLocType = await getLocationType(LocationValues.type_id);
        let key = 'constants'
        let constants = await Constant(key);
        if (LocationValues.container_id !== null) {
            const container = await models.locations.findOne({
                where: {
                    id: LocationValues.container_id,
                },
                include: [{
                    model: models.location_types,
                    required: true,
                    as: 'location_type',
                },],
                returning: true,
                raw: true,
            });
            const pathMap = {};
            const locationType = container['location_type.name'];
            pathMap[locationType] = container.name;
            path = container.path ? {
                ...container.path
            } : {};
            path[container.id] = pathMap;
            let obj = {};
            Object.keys(path).forEach((key) => {
                obj = {
                    ...obj,
                    ...path[key]
                };
            });
            let breadcrumb = '';
            constants.LocationLevels.forEach((element) => {
                if (element in obj) {
                    breadcrumb = `${breadcrumb}/${obj[element]}`;
                }
            });
            breadcrumb = `${breadcrumb}/${LocationValues.name}`;
            path.breadcrumb = breadcrumb;
        } else {
            path.breadcrumb = LocationValues.name;
        }
        await models.locations.create({
            company_id: LocationValues.company_id,
            name: LocationValues.name,
            notes: LocationValues.notes,
            container_id: LocationValues.container_id,
            address_id: LocationValues.address_id,
            type_id: LocationValues.type_id,
            created_by: LocationValues.user_id,
            updated_by: LocationValues.user_id,
            path,
            timezone: LocationValues.timezone,
        }).then((result) => {

            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

function getLocationType(id) {
    return new Promise(async (resolve, reject) => {
        await models.location_types.findOne({
            where: {
                id
            }
        })
            .then(result => {
                resolve(result)
            }).catch(err => {
                reject(err)
            })
    })
}

function getLocationTypeByName(site) {
    return new Promise(async (resolve, reject) => {
        await models.location_types.findOne({
            where: {
                name: site,
            }
        })
            .then(result => {
                resolve(result)
            }).catch(err => {
                reject(err)
            })
    })
}

function findContainerId(path) {
    return new Promise(async (resolve, reject) => {
        await models.locations.findOne({
            where: {
                path: {
                    breadcrumb: path
                },
            }
        })
            .then(result => {
                resolve(result)
            }).catch(err => {
                reject(err)
            })
    })
}

function findName(locationValues) {
    return new Promise(async (resolve, reject) => {

        const checkQuery = {
            name: locationValues.name,
            type_id: locationValues.type_id
        };
        if (locationValues.container_id !== null) {
            checkQuery.container_id = locationValues.container_id
        }
        await models.locations.findAll({
            where: checkQuery,
            raw: true,
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}
function createLocationPermission(locationData, jobId) {
    return new Promise(async (resolve, reject) => {
        const permission = [];
        const locationId = locationData.id;
        let constantKey = 'constants'
        let constants = await Constant(constantKey);
        const locationNew = await models.locations.findOne({
            where: {
                id: locationData.container_id
            },
            raw: true,
        })
        const locationType = await models.location_types.findOne({
            where: {
                id: locationData.type_id
            },
            raw: true,
        });
        const typeName = locationType.name;
        let role = null;
        if (constants.ROLES[typeName]) {
            role = constants.ROLES[typeName]
        }
        const query = {};
        const key = `path.${locationId}.${typeName}`;
        query[key] = locationNew.name;
        const companyId = locationData.company_id;
        const users = await models.locations_permissions.findAll({
            where: {
                location_id: locationNew.id,
            },
            attributes: ['user_id'],
            raw: true,
            distinct: true,
        });

        const userList = lodash.uniq(users, JSON.stringify);
        userList.forEach(async (user) => {
            const hasPermission = await models.locations_permissions
                .findOne({
                    where: {
                        user_id: user.user_id,
                        location_id: locationData.id,
                    },
                });
            if (!hasPermission) {
                await models.locations_permissions
                    .create({
                        location_id: locationData.id,
                        company_id: companyId,
                        user_id: user.user_id,
                        created_by: user.user_id,
                        updated_by: user.user_id,
                        role,
                    }).then((result) => {
                        permission.push(result)
                        resolve(permission)
                    }).catch(err => {
                        reject(err)
                    })
            }
        });
    })
}

function AddLocationPermission(location, userId, companyId) {
    return new Promise(async (resolve, reject) => {
        const typeName = location.location_type.name;
        let role = null;
        let key = 'constants'
        let constants = await Constant(key);constants
        if (constants.ROLES[typeName]) {
            role = constants.ROLES[typeName]
        }

        await models.locations_permissions
            .create({
                location_id: location.id,
                company_id: companyId,
                user_id: userId,
                created_by: userId,
                updated_by: userId,
                role,
            }).then(result => {
                resolve(result)
            }).catch(err => {
                reject(err)
            });
    })
}


function addLocation(locationData, jobId, locationLevel, companyId, userId) {
    return new Promise(async (resolve, reject) => {
        let count = 0
        let successList = []
        let constantKey = 'constants'
        let constants = await Constant(constantKey);
        for (let element of locationData) {
            let AdressValues = {
                line_1: element.address_line_1,
                line_2: element.address_line_2,
                line_3: element.address_line_3,
                city: element.city,
                state: element.state,
                country: element.country,
                zip_code: element.zip_code,
                geo_location: element.geo_location,
                total_area: element.area,
                company_id: companyId,
            };
            const LocationValues = {
                name: element.name,
                notes: element.notes,
                timezone: element.timezone,
                user_id: userId,
                company_id: companyId,
            };
            for (var key in LocationValues) {
                if (LocationValues[key] === '') {
                    LocationValues[key] = null;
                }
            }
            let isError = false
            if (element.type !== constants.LocationLevels[0]) {
                const conatinerId = await findContainerId(element.parent_path);
                if (conatinerId) {
                    LocationValues.container_id = conatinerId.id;
                    LocationValues.address_id = conatinerId.address_id;
                    const address = await getAddress(LocationValues.address_id)
                    for (var key in AdressValues) {
                        if (AdressValues[key] === '') {
                            AdressValues[key] = address[key];
                        }
                    }

                } else {
                    isError = true
                    addActivityLog(Entities.importLocations.entity_name, Entities.importLocations.event_name.job, element, `Path does not exists`, jobId, companyId)
                }

            }
            else {

                LocationValues.container_id = null;
            }
            if (isError == false) {
                const getTypeid = await getLocationTypeByName(locationLevel);
                LocationValues.type_id = getTypeid.id;
                let locationexist = false;
                const locationName = await findName(LocationValues)
                if (locationName.length > 0) {
                    locationexist = true
                    errorMessage = `Location '${LocationValues.name}'' is already exist with same name`
                    addActivityLog(Entities.importLocations.entity_name, Entities.importLocations.event_name.job, element, errorMessage, jobId, companyId)
                }
                if (locationexist == false) {
                    if (!(locationLevel === constants.LocationLevels[3] || locationLevel === constants.LocationLevels[4] || locationLevel === constants.LocationLevels[5])) {
                        addressDetails = await createAddress(AdressValues)
                            .catch(() => {
                                addActivityLog(Entities.importLocations.entity_name, Entities.importLocations.event_name.job, AdressValues, `address for '${element.name}' not added`, jobId, companyId)
                            })
                        if (addressDetails) {
                            addActivityLog(Entities.addresses.entity_name, Entities.addresses.event_name.added, addressDetails, 'Addresses added', addressDetails.id, companyId)
                            addActivityLog(Entities.importLocations.entity_name, Entities.importLocations.event_name.job, addressDetails, `address for '${element.name}' added successfully`, jobId, companyId);
                        }
                        LocationValues.address_id = addressDetails.id;
                    }
                    const location = await createLocations(LocationValues, jobId, companyId)
                        .then(async (input) => {
                            const locationTypes = await getLocationType(
                                input.type_id,
                            )
                            let mergedLocation = {};
                            mergedLocation = input.toJSON();
                            mergedLocation.address = addressDetails;
                            mergedLocation.location_type = locationTypes.toJSON();
                            return mergedLocation;
                        })
                    if (location) {
                        successList.push(location)
                        addActivityLog(Entities.locations.entity_name, Entities.locations.event_name.created, location, `${locationLevel} locations created`, location.id, companyId)
                        addActivityLog(Entities.importLocations.entity_name, Entities.importLocations.event_name.job, location, ` location  for '${element.name}' created successfully`, jobId, companyId);
                        if (location.location_type.name === constants.LocationLevels[0]) {
                            await AddLocationPermission(location, userId, companyId).then(result => {
                                addActivityLog(Entities.importLocations.entity_name, Entities.importLocations.event_name.job, `location permission for '${element.name}' added successfully.`, jobId, companyId);
                            }).catch(() => {
                                addActivityLog(Entities.importLocations.entity_name, Entities.importLocations.event_name.job, location, `location permission for '${element.name}' not added.`, jobId, companyId)
                            })
                        } else {
                            await createLocationPermission(location, jobId).then(() => {
                                addActivityLog(Entities.importLocations.entity_name, Entities.importLocations.event_name.job, location, `parent location permission for '${element.name}' added successfully`, jobId, companyId)
                            }).catch(() => {
                                addActivityLog(Entities.importLocations.entity_name, Entities.importLocations.event_name.job, `parent location permission for '${element.name}' not added`, jobId, companyId)
                            })
                        }
                    }
                    count = count + 1
                    if (count == locationData.length) {
                        resolve(successList)
                    }
                } else {
                    count = count + 1
                    if (count == locationData.length) {
                        resolve(successList)
                    }
                }
            } else {
                count = count + 1
                if (count == locationData.length) {
                    resolve(successList)
                }
            }

        }
    })
}

const manage = function (obj) {
    return new Promise(async (resolve, reject) => {

        const locationList = JSON.parse(obj.input.locationList)
        const jobId = obj.jobId
        const companyId = obj.companyId
        const userId = obj.input.userId
        let key = 'constants'
        let constants = await Constant(key);
        const listOfSites = locationList.filter(item => item.type === constants.LocationLevels[0])
        const sites = await addLocation(listOfSites, jobId, constants.LocationLevels[0], companyId, userId)

        const listOfBuildings = locationList.filter(item => item.type === constants.LocationLevels[1])
        const buildings = await addLocation(listOfBuildings, jobId, constants.LocationLevels[1], companyId, userId)

        const listOfFloors = locationList.filter(item => item.type === constants.LocationLevels[3])
        const floors = await addLocation(listOfFloors, jobId, constants.LocationLevels[3], companyId, userId)

        const listOfRooms = locationList.filter(item => item.type === constants.LocationLevels[5])
        const rooms = await addLocation(listOfRooms, jobId, constants.LocationLevels[5], companyId, userId)

        const listOfarea = locationList.filter(item => item.type === constants.LocationLevels[2])
        const areas = await addLocation(listOfarea, jobId, constants.LocationLevels[2], companyId, userId)

        const listOfstreets = locationList.filter(item => item.type === constants.LocationLevels[4])
        const streets = await addLocation(listOfstreets, jobId, constants.LocationLevels[4], companyId, userId)

        const listOfhouses = locationList.filter(item => item.type === constants.LocationLevels[6])
        const houses = await addLocation(listOfhouses, jobId, constants.LocationLevels[6], companyId, userId)

        const successCount = sites.length + buildings.length + floors.length + rooms.length + areas.length + streets.length + houses.length
        const errorCount = locationList.length - successCount
        addActivityLog(Entities.importLocations.entity_name, Entities.importLocations.event_name.job, {
            FailedCount: errorCount,
            SuccessCount: successCount,
            TotalCount: locationList.length
        }, `Out of ${locationList.length} records, ${successCount} has been added and ${errorCount} has failed to add.`, jobId, companyId)
        resolve()
    })
}

module.exports = {
    manage
}