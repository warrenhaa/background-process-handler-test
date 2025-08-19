const models = require('../models');
const { Op, literal } = models.Sequelize;
const { addActivityLog } = require('./ActivityLogService')
const locationCheckOutService = require('./LocationCheckOutService');
const { createJob, updateJob } = require('../services/JobsService')
const { deviceProvison } = require('./deviceProvisionService');
const Logger = require('../Logger');
const { Constant } = require('../Constants')
const { Entities } = require('../utils/Entities');
const deleteUserService = require('./deleteUserService');
const { getCompany } = require('../cache/Companies');
const { getFromTable, deleteFromTable} = require('../dynamodb');
let AWS = require('aws-sdk');
const moment = require('moment');
const {cognitoLogin} = require("./UserService");

function occupantInvitationDelete(email) {
    return new Promise(async (resolve, reject) => {
        await models.occupants_invitations.destroy({ where: { email } }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

function occupantlocationDelete(occupantId, jobId, companyId) {
    return new Promise(async (resolve, reject) => {
        await models.occupants_locations.destroy({ where: { occupant_id: occupantId } }).then(result => {
            if (result === 1) {
                addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.occupant_location_delete, { occupant_id: occupantId }, "Occupant location deleted successfully", jobId, companyId);
            }
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

function occupantNotificationTokenDelete(occupantId, jobId, companyId) {
    return new Promise(async (resolve, reject) => {
        await models.occupants_notification_tokens.destroy({ where: { occupant_id: occupantId } }).then(result => {
            if (result === 1) {
                addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.occupant_notification_token_deleted, { occupant_id: occupantId }, "Occupant notification deleted successfully", jobId, companyId);
            }
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

async function occupantPermissionDelete(occupantId, jobId, companyId) {
    const permissions = await models.occupants_permissions.findAll({
            include: [{
                required: true,
                attributes: ['id', 'email', 'first_name', 'last_name', 'phone_number', 'identity_id', 'cognito_id'],
                model: models.occupants,
                as: 'receiver_occupant',
            }, {
                model: models.devices,
                as: 'gateway',
            }],
            where: {
                [Op.or]: [
                    {receiver_occupant_id: occupantId},
                    {sharer_occupant_id: occupantId}
                ],
            }
        }).catch(error => {
            console.log(error)
            const err = ErrorCodes['490003'];
            throw err;
        })

    if (permissions.length > 0) {

        const adminEmail = process.env.ADMIN_EMAIL;
        const password = process.env.ADMIN_PASSWORD;
        const reqObj = {
            body: {
                company_id: companyId,
            },
        };
        const AdminData = await cognitoLogin(reqObj, adminEmail, password);
        let permissionTasks = [];
        for (let i = 0; i < permissions.length; i++) {
            //console.log("🚀 ~ file: deleteOccupantService.js:82 ~ permission:", permissions[i])
            permissionTasks.push(removeDeviceProvison(permissions[i], occupantId, jobId, companyId, AdminData));
        }

        await Promise.all(permissionTasks)
            .then((results) => {
                return results;
            }).catch(err => {
                reject(err)
            });
    }

}

function removeDeviceProvison(permission, occupantId, jobId, companyId, AdminData) {
    return new Promise(async (resolve, reject) => {
        const headerParams = {
            Authorization: AdminData.accessToken,
        };

        if (permission.sharer_occupant_id == permission.receiver_occupant_id) {
            //owner
            if ( permission.gateway ) {
                if (headerParams.Authorization) {
                    const userFormObj = {
                        UserID: AdminData.identityId,
                        Username: permission.receiver_occupant.email,
                        Command: 22,
                        DeviceID: permission.gateway.device_code
                    };

                    await deviceProvison(headerParams, userFormObj, 0).catch(err => {
                        addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.job, userFormObj, err.message, jobId, companyId)
                    }).then(result => {
                        resolve(result)
                    }).catch(err => {
                        reject(err)
                    })
                }
            }
        }

        if (permission.sharer_occupant_id == occupantId && permission.receiver_occupant_id != occupantId) {
            //owner share to receiver
            if ( permission.gateway ) {

                if (headerParams && headerParams.Authorization) {
                    const userFormObj = {
                        UserID: AdminData.identityId,
                        Username: permission.receiver_occupant.email,
                        Command: 4,
                        DeviceID: permission.gateway.device_code
                    };

                    await deviceProvison(headerParams, userFormObj, 0).catch(err => {
                        addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.job, userFormObj, err.message, jobId, companyId)
                    }).then(result => {
                        resolve(result)
                    }).catch(err => {
                        reject(err)
                    })
                }
            }

        }

        if (permission.sharer_occupant_id != permission.receiver_occupant_id && permission.receiver_occupant_id == occupantId) {
            //receiver
            if (permission.gateway) {
                if (headerParams.Authorization) {
                    const userFormObj = {
                        UserID: AdminData.identityId,
                        Username: permission.receiver_occupant.email,
                        Command: 4,
                        DeviceID: permission.gateway.device_code
                    };

                    await deviceProvison(headerParams, userFormObj, 0).catch(err => {
                        addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.job, userFormObj, err.message, jobId, companyId)
                    }).then(result => {
                        resolve(result)
                    }).catch(err => {
                        reject(err)
                    })
                }
                await removeAlertCommunicationConfigs(permission.receiver_occupant_id , permission.gateway.id)
            }

        }

        await removePermission(permission, occupantId, jobId, companyId)
    })
}

function removePermission(permission, occupantId, jobId, companyId) {
    return new Promise(async (resolve, reject) => {
        await models.occupants_permissions.destroy({
            where: {
                id: permission.id
            }
        }).then(result => {
            if (result === 1) {
                addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.occupant_permission_deleted, {receiver_occupant_id: occupantId}, "Occupant permission deleted successfully", jobId, companyId);
            }
            resolve(result);
        }).catch((err) => {
            console.log("🚀 ~ file: removePermissions.js:145 ~ err:", err)
            reject(err)
        });
    })
}

function removeAlertCommunicationConfigs(occupantId, gatewayId) {


    return new Promise(async (resolve, reject) => {
        const devices = await database.devices.findAll({
            where: {
                gateway_id: gatewayId
            }
        }).catch(() => {
            const err = ErrorCodes['800032'];
            throw err;
        });

        if (devices && devices.length > 0) {

            await database.alert_communication_configs.destroy({
                where: {
                    occupant_id: occupantId,
                    device_id: {
                        [Op.in]: devices.map(device => device.id)
                    }
                }
            }).catch(() => {
                const err = ErrorCodes['800032'];
                throw err;
            });

        }
        resolve();
    });
}

function occupantDashboardAttributesDelete(occupantId, jobId, companyId) {
    return new Promise(async (resolve, reject) => {
        await models.occupants_dashboard_attributes.destroy({ where: { occupant_id: occupantId } }).then(result => {
            if (result === 1) {
                addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.occupant_dashboard_attribute_deleted, { occupant_id: occupantId }, "Occupant dashboard attributes deleted successfully", jobId, companyId);
            }
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

function occupantGroupsDelete(occupantId, jobId, companyId) {
    return new Promise(async (resolve, reject) => {
        await models.occupants_groups.destroy({ where: { occupant_id: occupantId } }).then(result => {
            if (result === 1) {
                addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.occupant_group_deleted, { occupant_id: occupantId }, "Occupant groups deleted successfully", jobId, companyId);
            }
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

function occupantMetadataDelete(occupantId, jobId, companyId) {
    return new Promise(async (resolve, reject) => {
        await models.occupants_metadata.destroy({ where: { occupant_id: occupantId } }).then(result => {
            if (result === 1) {
                addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.occupant_metadata_deleted, { occupant_id: occupantId }, "Occupant metadata deleted successfully", jobId, companyId);
            }
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

function occupantDeleteFromAlertCommunicationConfig(occupantId, jobId, companyId) {
    return new Promise(async (resolve, reject) => {
        await models.alert_communication_configs.destroy({ where: { occupant_id: occupantId } }).then(result => {
            if (result === 1) {
                addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.alert_communication_config_deleted, { occupant_id: occupantId }, "Alert communication deleted successfully", jobId, companyId);
            }
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

function deleteOccupantCognito(userName, company) {
    return new Promise(async (resolve, reject) => {

        const userPoolId = company.aws_cognito_user_pool;
        const region = company.aws_region;
        AWS.config.update({
            region: company.aws_region,
            accessKeyId: company.aws_iam_access_key,
            secretAccessKey: company.aws_iam_access_secret,
        });
        const cognitoIdentity = new AWS.CognitoIdentityServiceProvider({ region });
        const deleteParams = {
            Username: userName,
            UserPoolId: userPoolId
        };
        try {
            const result = await cognitoIdentity.adminDeleteUser(deleteParams).promise();
            resolve(result);
        } catch (error) {
            reject(error);
        }
    })
}

function occupantDelete(occupantId, jobId, companyId, email, userName) {
    return new Promise(async (resolve, reject) => {
        let deleteOccupantLanguage = null;
        let first_last_name = null;
        let first_name = null;
        let last_name = null;
        // get occupant first and fetch the language
        const occupantsData = await models.occupants.findOne({
            where: {
                id: occupantId,
            }
        }).then(result => {
            return result;
        }).catch((err) => {
            reject(err);
        });

        deleteOccupantLanguage = (occupantsData && occupantsData.language) ? occupantsData.language : null;
        first_last_name = (occupantsData && occupantsData.first_name != null && occupantsData.last_name != null) ? `${occupantsData.first_name} ${occupantsData.last_name}` : null;
        first_name = (occupantsData && occupantsData.first_name != null) ? occupantsData.first_name : null;
        last_name = (occupantsData && occupantsData.first_name != null && occupantsData.last_name != null) ? occupantsData.last_name : null;

        await models.occupants.destroy({ where: { id: occupantId, } }).then(result => {
            if (result === 1) {
                const placeholders_data = {
                    user_name: (first_name && first_name != null) ? first_name : userName,
                    email: email,
                    language: deleteOccupantLanguage,
                    first_last_name: first_last_name,
                    first_name: first_name,
                    last_name: last_name,
                    receiverList: [{ email: email }],
                };
                addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.occupant_delete, { occupant_id: occupantId }, "Occupant deleted successfully", jobId, companyId, placeholders_data);
            }
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

function deleteOccupantDefaultRoom(email, code, jobId, companyId) {
    return new Promise(async (resolve, reject) => {
        const name = `${email}_${code}_default_room`;
        await models.locations.findOne({ where: { name } }).then(async (result) => {
            if (result) {
                let location_id = result.id;
                // console.log("🚀 ~ file: deleteOccupantService.js:195 ~ awaitmodels.locations.findOne ~ location_id:", location_id)
                await models.devices.findAll({
                    where: {
                        location_id
                    }
                }).then(async(data) => {
                // console.log("🚀 ~ file: deleteOccupantService.js:201 ~ awaitmodels.locations.findOne ~ data:", data)

                    if (data.length > 0) {
                       await models.devices.update({
                            location_id: null
                        },
                            {
                                where: {
                                    location_id
                                }
                            },
                        ).then(x => {
                        console.log("🚀 ~ file: deleteOccupantService.js:212 ~ awaitmodels.locations.findOne ~ x:", x)

                    }).catch(err => {
                        console.log("🚀 ~ file: deleteOccupantService.js:219 ~ awaitmodels.locations.findOne ~ err:", err)
                        reject(err)
                    })

                    }
                })
                await models.locations.destroy({ where: { name, } })
                    .then(result => {
                        addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.occupant_default_room_delete, name, "Occupants default room delete successfully", jobId, companyId);
                        resolve(result)
                    }).catch(err => {
                        reject(err)
                    })
            }
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

function checkOccupantIsUser(email, companyId) {
    return new Promise((resolve, reject) => {
        models.users.findOne({ where: { email, company_id: companyId } }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}

const manage = function (obj) {
    return new Promise(async (resolve, reject) => {
        const occupantId = obj.input.occupantId;
        const userId = obj.input.userId;
        const jobId = obj.jobId;
        let companyId = obj.companyId
        let companyCreds = null;
        const authorization = obj.input.authorization
        const userIdentityId = obj.input.userIdentityId
        const email = obj.input.email;
        const userName = obj.input.userName;
        const headerParams = {
            'x-company-code': companyId,
            Authorization: authorization,
        };
        let key = 'constants'
        let constants = await Constant(key);
        const userFormObj = {
            UserID: userIdentityId,
            Username: email,
            Command: constants.DeviceProvision.REMOVE_USER_RECORD,
        };

        let locations = await models.occupants_locations.findAll({ where: { occupant_id: occupantId, status: 'checked in' } });

        for (const location of locations) {
            if (location && location.status === 'checked in' && obj.input.adminIdentityId) {
                obj.input.locationId = location.location_id;
                await locationCheckOutService.manage(obj);
            }
        }
        if (!companyCreds) {
            const company = await getCompany(companyId).then(result => {
                return (result);
            }).catch(err => {
                reject(err);
            });
            if (!company || !company.id) {
                Logger.info("Info-Error", { "message": "Company id is wrong, not found company id to postgres db.", value: companyId })
                resolve();
            }

            companyId = company.id
            companyCreds = company
            AWS.config.update({
                region: companyCreds.aws_region,
                accessKeyId: companyCreds.aws_iam_access_key,
                secretAccessKey: companyCreds.aws_iam_access_secret
            });
        }
        addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.job, obj, "Job processing started.", jobId, companyId).catch(error => { reject(error) })
        await occupantlocationDelete(occupantId, jobId, companyId).catch(error => {
            addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.occupant_location_delete, error, "Occupant permissions not deleted", jobId, companyId);
            reject(error)
        })
        // if (headerParams.Authorization) {
        //     await deviceProvison(headerParams, userFormObj, 0).catch(err => {
        //         addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.job, obj, err.message, jobId, companyId)
        //     })
        //     addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.device_provision_delete, obj, "Device Provision deleted successfully", jobId, companyId);
        // }



        await occupantPermissionDelete(occupantId, jobId, companyId).catch(error => {
            addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.occupant_permission_deleted, error, "Occupant permissions not deleted", jobId, companyId);
            reject(error)
        })

        await occupantDashboardAttributesDelete(occupantId, jobId, companyId).catch(error => {
            addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.occupant_dashboard_attribute_deleted, error, "Occupant dashboard attributes not deleted", jobId, companyId);
            reject(error)
        })

        await occupantNotificationTokenDelete(occupantId, jobId, companyId).catch(error => {
            addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.occupant_notification_token_deleted, error, "Occupant notification tokens not deleted", jobId, companyId);
            reject(error)
        })

        await occupantGroupsDelete(occupantId, jobId, companyId).catch(error => {
            addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.occupant_group_deleted, error, "occupant groups not deleted", jobId, companyId);
            reject(error)
        })

        await occupantMetadataDelete(occupantId, jobId, companyId).catch(error => {
            addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.occupant_metadata_deleted, error, "Occupant metadata not deleted", jobId, companyId);
            reject(error)
        })

        await occupantDeleteFromAlertCommunicationConfig(occupantId, jobId, companyId).catch(error => {
            addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.alert_communication_config_deleted, error, "Alert communication config not deleted", jobId, companyId);
            reject(error)
        })

        //check delete occupant has user record
        var user = await checkOccupantIsUser(email, companyId).catch(error => {
            addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.job, error, "Error while finding occupant is user", jobId, companyId);
            reject(error)
        })
        if (user) {
            addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.job, user, "User record found, started deleting", jobId, companyId);
            var occupantUserId = user.id
            await deleteUserService.corePermissionsDelete(occupantUserId).then((result) => {
                addActivityLog(Entities.deleteOccupant.entity_name, Entities.userDelete.event_name.core_permission_delete, { user_id: occupantUserId }, "Core permissions deleted", jobId, companyId);
                return result;
            }).catch(error => { reject(error) });

            await deleteUserService.locationsPermissionsDelete(occupantUserId).then((result) => {
                addActivityLog(Entities.deleteOccupant.entity_name, Entities.userDelete.event_name.location_permission_delete, { user_id: occupantUserId }, "Location permissions deleted", jobId, companyId);
                return result;
            }).catch(error => { reject(error) });

            await deleteUserService.accessPermissionsDelete(occupantUserId).then((result) => {
                addActivityLog(Entities.deleteOccupant.entity_name, Entities.userDelete.event_name.access_permission_delete, { user_id: occupantUserId }, "Access permissions deleted", jobId, companyId);
                return result;
            }).catch(error => { reject(error) });

            await deleteUserService.activityLogsDelete(occupantUserId).then((result) => {
                addActivityLog(Entities.deleteOccupant.entity_name, Entities.userDelete.event_name.activity_logs_delete, { user_id: occupantUserId }, "Activity logs deleted", jobId, companyId);
                return result;
            }).catch(error => { reject(error) });

            await deleteUserService.occupantsInvitationsUpdate(occupantUserId).then((result) => {
                addActivityLog(Entities.deleteOccupant.entity_name, Entities.userDelete.event_name.occupant_invitation_update, { user_id: occupantUserId }, "Invited Occupant invitations updated.", jobId, companyId);
                return result;
            }).catch(error => { reject(error) });

            await deleteUserService.usersDelete(occupantUserId).then((result) => {
                addActivityLog(Entities.deleteOccupant.entity_name, Entities.userDelete.event_name.user_delete, { user_id: occupantUserId }, "User deleted", jobId, companyId);
                return result;
            }).catch(error => {
                reject(error);
            });

            await deleteUserService.deleteUserInvitations(email).then(result => {
                addActivityLog(Entities.deleteOccupant.entity_name, Entities.userDelete.event_name.user_invitation_delete, { user_id: occupantUserId }, "User invitations deleted", jobId, companyId);
                return result;
            }).catch(error => {
                reject(error);
            });

        } else {
            addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.job, { email }, "User record not found", jobId, companyId);
        }

        if (companyCreds) {
            await deleteOccupantDefaultRoom(email, companyCreds.code, jobId, companyId).catch(error => { reject(error) })
        }

        await occupantDelete(occupantId, jobId, companyId, email, userName).catch(error => {
            addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.occupant_delete, error, "Occupant not deleted", jobId, companyId);
            reject(error)
        })
        await occupantInvitationDelete(email).then(async (result) => {
            addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.occupant_invite_delete, obj, "Occupants invitation deleted successfully", jobId, companyId);
            // await deleteOccupantCognito(email, companyCreds).catch(error => {
            //     Logger.error("Info-Error", { "msg": "User not exists in cognito", value: { occupantId, jobId } })
            //     addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.cognito_occupant_delete, obj, "Occupant not deleted from cognito.", jobId, companyId);
            // });
            // addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.cognito_occupant_delete, obj, "Occupant deleted from cognito successfully", jobId, companyId);
            resolve()
        }).catch(error => { reject(error) })

    })
}

const deleteDnd = () => {

    return new Promise(async (resolve, reject) => {
        const occupantsEquipmentData = await models.occupants_equipments_data.findAll({
            where: {
                [Op.and]: [
                    literal("value::text like '%DND%%date%'")
                ],
            },
        }).catch((err) => {
            reject(err)
        });

        //console.log("🚀 ~ file: deleteOccupantService.js:100 ~ occupantsEquipmentData:", occupantsEquipmentData)

        if (occupantsEquipmentData && occupantsEquipmentData.length > 0) {
            occupantsEquipmentData.forEach(async (element) => {
                const compareDate = moment(element.value.DND.utc_date).add(element.value.DND.hours, 'hours').toDate();
                // console.log("🚀 ~ file: deleteOccupantService.js:105 ~ compareDate:", compareDate)
                // console.log("🚀 ~ file: deleteOccupantService.js:105 ~ current date:", new Date())

                if (compareDate < new Date()) {
                    let update_data = element.value
                    update_data.DND = null;

                    await models.occupants_equipments_data.update({
                        value: update_data
                    }, {
                        where: {
                            id: element.id
                        }
                    });
                }
            });
        }

    })

}

module.exports = {
    manage, occupantlocationDelete, occupantPermissionDelete, occupantDashboardAttributesDelete, occupantNotificationTokenDelete, occupantGroupsDelete, occupantMetadataDelete, occupantDeleteFromAlertCommunicationConfig, occupantDelete, occupantInvitationDelete, deleteOccupantCognito, deleteDnd
}
