const models = require('../models');
const { addActivityLog } = require('./ActivityLogService');
const { deviceProvison } = require('./deviceProvisionService');
const { getFromTable } = require('../dynamodb');
const { Constant } = require('../Constants')
const { Entities } = require('../utils/Entities')
var deleteOccupantService = require('./deleteOccupantService')
const Logger = require('../Logger');
const AWS = require('aws-sdk');
const { getCompany } = require('../cache/Companies');

function corePermissionsDelete(userId) {
    return new Promise((resolve, reject) => {
        models.core_permissions.destroy({ where: { user_id: userId, } })
            .then(result => {
                resolve(result)
            }).catch(err => {
                reject(err)
            })
    })
}
function locationsPermissionsDelete(userId) {
    return new Promise((resolve, reject) => {
        models.locations_permissions.destroy({ where: { user_id: userId, } })
            .then(result => {
                resolve(result)
            }).catch(err => {
                reject(err)
            })
    })
}
function accessPermissionsDelete(userId) {
    return new Promise((resolve, reject) => {
        models.access_permissions.destroy({ where: { user_id: userId, } })
            .then(result => {
                resolve(result)
            }).catch(err => {
                reject(err)
            })
    })
}
// function deviceAlertHistoriesDelete(userId) {
//     return new Promise((resolve, reject) => {
//         models.device_status_actions.destroy({ where: { user_id: userId, } })
//             .then(result => {
//                 resolve(result)
//             }).catch(err => {
//                 reject(err)
//             })
//     })
// }
function activityLogsDelete(userId) {
    return new Promise((resolve, reject) => {
        models.activity_logs.destroy({ where: { user_id: userId, } })
            .then(result => {
                resolve(result)
            }).catch(err => {
                reject(err)
            })
    })
}
function occupantsInvitationsUpdate(userId) {
    return new Promise((resolve, reject) => {
        models.occupants_invitations.update({ invited_by: null }, { where: { invited_by: userId, } })
            .then(result => {
                resolve(result);
            }).catch(err => {
                reject(err);
            })
    })
}
function deleteUserCognito(userName, company) {
    return new Promise(async (resolve, reject) => {

        const userPoolId = company.aws_cognito_user_pool;
        const region = company.aws_region;
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
function deleteUserInvitations(userName) {
    ``
    return new Promise((resolve, reject) => {
        models.user_invitations.destroy({ where: { email: userName, } })
            .then(result => {
                resolve(result)
            }).catch(err => {
                reject(err)
            })
    })
}
function usersDelete(userId) {
    return new Promise((resolve, reject) => {
        models.users.destroy({ where: { id: userId, } })
            .then(result => {
                resolve(result)
            }).catch(err => {
                reject(err)
            })
    })
}
function checkUserIsOccupant(email, companyId) {
    return new Promise((resolve, reject) => {
        models.occupants.findOne({ where: { email, company_id: companyId } }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}
var getUserCredentials = function (UserName) {
    return new Promise((resolve, reject) => {

        var params = {
            TableName: 'UserToDeviceList',
            FilterExpression: "#user_name = :user_name_val",
            ExpressionAttributeNames: {
                "#user_name": "UserName",
            },
            ExpressionAttributeValues: {
                ":user_name_val": UserName
            }
        };
        getFromTable(params).then(result => {
            if (result && result.length > 0) {

                resolve(result[0])
            } else {
                resolve(null)
            }
        }).catch((err) => {
            reject(err);
        });


    })
}
function userDeleteFromDeviceProvision(userName, userIdentityId, authorization) {
    return new Promise(async (resolve, reject) => {

        const headerParams = {
            'x-company-code': process.env.COMPANY_CODE,
            Authorization: authorization
        };
        let key = 'constants'
        let constants = await Constant(key);
        const userFormObj = {
            UserID: userIdentityId,
            Username: userName,
            Command: constants.DeviceProvision.REMOVE_USER_RECORD
        };
        deviceProvison(headerParams, userFormObj, 0)
            .then(result => {
                resolve(result)
            }).catch(err => {
                reject(err)
            })
    })
}
const manage = function (obj) {
    return new Promise(async (resolve, reject) => {
        let { userId, userName, authorization, userIdentityId } = obj.input
        const jobId = obj.jobId;
        let companyId = obj.companyId;
        let companyCreds = null;
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
        if (!userIdentityId) {
            var userDetails = await getUserCredentials(userName).catch(error => { reject(error) });
            if (userDetails) {
                userIdentityId = userDetails.userid
            }
        }

        await corePermissionsDelete(userId).catch(error => { reject(error) })
        addActivityLog(Entities.userDelete.entity_name, Entities.userDelete.event_name.core_permission_delete, { user_id: userId }, "Core permissions deleted", jobId, companyId)
        await locationsPermissionsDelete(userId).catch(error => { reject(error) });
        addActivityLog(Entities.userDelete.entity_name, Entities.userDelete.event_name.location_permission_delete, { user_id: userId }, "Location permissions deleted", jobId, companyId)
        await accessPermissionsDelete(userId).catch(error => { reject(error) });
        addActivityLog(Entities.userDelete.entity_name, Entities.userDelete.event_name.access_permission_delete, { user_id: userId }, "Access permissions deleted", jobId, companyId)
        // await deviceAlertHistoriesDelete(userId).catch(error => { reject(error) });
        // addActivityLog("UserDeleteJob", "DeviceAlertHistoriesDeleted", { user_id: userId }, "", jobId, companyId)
        await activityLogsDelete(userId).catch(error => { reject(error) });
        addActivityLog(Entities.userDelete.entity_name, Entities.userDelete.event_name.activity_logs_delete, { user_id: userId }, "Activity logs deleted", jobId, companyId)
        await occupantsInvitationsUpdate(userId).catch(error => { reject(error) });
        addActivityLog(Entities.userDelete.entity_name, Entities.userDelete.event_name.occupant_invitation_update, { user_id: userId }, "Invited Occupant invitations updated.", jobId, companyId)
        // await deleteUserCognito(userName, companyCreds).catch(error => {
        //     Logger.info("Info-Error", { "msg": "User not exists in cognito", value: { userName, jobId } })
        // });
        addActivityLog(Entities.userDelete.entity_name, Entities.userDelete.event_name.cognito_user_delete, { user_id: userId }, "User deleted from Cognito", jobId, companyId)
        await usersDelete(userId).catch(error => {
            reject(error);
        });
        addActivityLog(Entities.userDelete.entity_name, Entities.userDelete.event_name.user_delete, { user_id: userId }, "User deleted", jobId, companyId)
        // if (userIdentityId) {
        //     // await userDeleteFromDeviceProvision(userName, userIdentityId, authorization).catch(error => { reject(error) });
        //     // addActivityLog(Entities.userDelete.entity_name, Entities.userDelete.event_name.dynamodb_user_delete, { user_id: userId }, "User deleted from dynamo using device provision api", jobId, companyId)
        // }

        //check delete user has occupants record
        var occupant = await checkUserIsOccupant(userName, companyId).catch(error => {
            addActivityLog(Entities.userDelete.entity_name, Entities.userDelete.event_name.job, error, "Error while finding user is occupant", jobId, companyId);
            reject(error)
        })

        if (occupant) {
            var occupantId = occupant.id
            addActivityLog(Entities.userDelete.entity_name, Entities.userDelete.event_name.job, occupant, "Occupant record  found", jobId, companyId);
            await deleteOccupantService.occupantlocationDelete(occupantId, jobId, companyId).catch(error => {
                addActivityLog(Entities.userDelete.entity_name, Entities.deleteOccupant.event_name.occupant_location_delete, error, "Occupant location not deleted", jobId, companyId);
                reject(error)
            })

            await deleteOccupantService.occupantPermissionDelete(occupantId, jobId, companyId).catch(error => {
                addActivityLog(Entities.userDelete.entity_name, Entities.deleteOccupant.event_name.occupant_permission_deleted, error, "Occupant permissions not deleted", jobId, companyId);
                reject(error)
            })

            await deleteOccupantService.occupantDashboardAttributesDelete(occupantId, jobId, companyId).catch(error => {
                addActivityLog(Entities.userDelete.entity_name, Entities.deleteOccupant.event_name.occupant_dashboard_attribute_deleted, error, "Occupant dashboard attributes not deleted", jobId, companyId);
                reject(error)
            })

            await deleteOccupantService.occupantNotificationTokenDelete(occupantId, jobId, companyId).catch(error => {
                addActivityLog(Entities.userDelete.entity_name, Entities.deleteOccupant.event_name.occupant_notification_token_deleted, error, "Occupant notification tokens not deleted", jobId, companyId);
                reject(error)
            })

            await deleteOccupantService.occupantGroupsDelete(occupantId, jobId, companyId).catch(error => {
                addActivityLog(Entities.userDelete.entity_name, Entities.deleteOccupant.event_name.occupant_group_deleted, error, "occupant groups not deleted", jobId, companyId);
                reject(error)
            })

            await deleteOccupantService.occupantMetadataDelete(occupantId, jobId, companyId).catch(error => {
                addActivityLog(Entities.userDelete.entity_name, Entities.deleteOccupant.event_name.occupant_metadata_deleted, error, "Occupant metadata not deleted", jobId, companyId);
                reject(error)
            })

            await deleteOccupantService.occupantDeleteFromAlertCommunicationConfig(occupantId, jobId, companyId).catch(error => {
                addActivityLog(Entities.userDelete.entity_name, Entities.deleteOccupant.event_name.alert_communication_config_deleted, error, "Alert communication config not deleted", jobId, companyId);
                reject(error)
            })

            await deleteOccupantService.occupantDelete(occupantId, jobId, companyId, userName).catch(error => {
                addActivityLog(Entities.userDelete.entity_name, Entities.deleteOccupant.event_name.occupant_delete, error, "Occupant not deleted", jobId, companyId);
                reject(error)
            })
            await deleteOccupantService.occupantInvitationDelete(userName).then(async (result) => {
                addActivityLog(Entities.userDelete.entity_name, Entities.deleteOccupant.event_name.occupant_invite_delete, occupant, "Occupants invitation deleted successfully", jobId, companyId);
            }).catch(error => { reject(error) })

        } else {
            addActivityLog(Entities.userDelete.entity_name, Entities.userDelete.event_name.job, { email: userName }, "Occupant record not found", jobId, companyId);
        }

        await deleteUserInvitations(userName)
            .then(result => {
                addActivityLog(Entities.userDelete.entity_name, Entities.userDelete.event_name.user_invitation_delete, { user_id: userId }, "User invitations deleted", jobId, companyId)
                resolve(result);
            }).catch(error => { reject(error) });
    })
}

module.exports = {
    manage, corePermissionsDelete, locationsPermissionsDelete, accessPermissionsDelete, activityLogsDelete, occupantsInvitationsUpdate, deleteUserInvitations, usersDelete
}
