const models = require('../models');
const { createJob, updateJob } = require('../services/JobsService')
const deleteOccupantService = require('../services/deleteOccupantService')
const deleteUserService = require('../services/deleteUserService')
const Logger = require('../Logger');
const { Entities } = require('../utils/Entities');
const { addActivityLog } = require('../services/ActivityLogService')
const { getCompany } = require('../cache/Companies');

const manage = function (obj) {
    return new Promise(async (resolve, reject) => {
        let table = obj.table
        let type = obj.type
        let data = obj.data
        if (type == 'remove' && table == 'UserToDeviceList') {
            if (data) {
                let identity_id = data.userid
                if (identity_id) {
                    //get occupant
                    var occupant = await models.occupants.findOne({
                        where: {
                            identity_id
                        }

                    }).catch((error) => {
                        reject(error)
                    });
                    //get user
                    var user = await models.users.findOne({
                        where: {
                            identity_id
                        }
                    }).catch((error) => {
                        reject(error)
                    });

                    //if any record found
                    if (occupant || user) {
                        let email, occupantId, userId = null

                        if (occupant) {
                            email = occupant.email
                            occupantId = occupant.id
                        } else if (user) {
                            email = user.email
                            userId = user.id
                        }

                        //get company
                        const company = await getCompany(occupant.company_id).then(result => {
                            return (result);
                        }).catch(err => {
                            reject(err);
                        });
                        // console.log("🚀 ~ file: DynamoDBTriggerStreamHandler.js:48 ~ returnnewPromise ~ company:", company)
                        let companyId = occupant.company_id

                        // delete from cognito
                        if (email) {
                            await deleteOccupantService.deleteOccupantCognito(email, company)
                                .catch((error) => {
                                    console.log("🚀 ~ file: OccupantDeleteHandler.js:54 ~ returnnewPromise ~ error:", error)
                                });
                        }
                        if (occupant) {
                            //create job for occupant
                            const input = {
                                occupantId: occupantId,
                                userId: userId,
                                email: email,
                                userName: occupant.email,
                                userIdentityId: identity_id
                            };
                            createJob("deleteOccupant", "Started", input, companyId).then(async (result) => {
                                const jobId = result.id;

                                //delete occupant
                                const obj = {
                                    jobId,
                                    type,
                                    input,
                                    companyId,
                                };
                                //delete occupant
                                await deleteOccupantService.manage(obj).catch((error) => {
                                    console.log("🚀 ~ file: DynamoDBTriggerStreamHandler.js:85 ~ createJob ~ error:", error)
                                    updateJob("Failed", jobId)
                                    addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.job, obj, "Job failed.", jobId, companyId)
                                    reject(error)
                                });
                                updateJob("Finished", jobId)
                                addActivityLog(Entities.deleteOccupant.entity_name, Entities.deleteOccupant.event_name.job, obj, "Job finished.", jobId, companyId)
                                resolve()

                            }).catch(err => {
                                reject(err)
                            })

                        } else if (user) {
                            //create job for user
                            const input = {
                                occupantId: occupantId,
                                userId: userId,
                                email: email,
                                userName: occupant.email,
                                userIdentityId: identity_id
                            };
                            createJob("deleteUser", "Started", input, companyId).then(async (result) => {
                                const jobId = result.id;

                                //delete occupant
                                const obj = {
                                    jobId,
                                    type,
                                    input,
                                    companyId,
                                };
                                //delete user
                                await deleteUserService.manage(obj).catch((error) => {
                                    console.log("🚀 ~ file: DynamoDBTriggerStreamHandler.js:118 ~ createJob ~ error:", error)
                                    updateJob("Failed", jobId)
                                    addActivityLog(Entities.userDelete.entity_name, Entities.userDelete.event_name.job, obj, "Job failed.", jobId, companyId)
                                    reject(error)
                                });
                                updateJob("Finished", jobId)
                                addActivityLog(Entities.userDelete.entity_name, Entities.userDelete.event_name.job, obj, "Job finished.", jobId, companyId)
                                resolve();
                            }).catch(err => {
                                reject(err)
                            })
                        } else {
                            console.log("dynamoDBTriggerStream", { "message": "identity id  not found in users and occupants table.", "data": obj });
                            let err = { "message": "occupant or user not found in users and occupants table.", "data": obj }
                            resolve(err);
                        }
                    } else {
                        console.log("dynamoDBTriggerStream", { "message": "identity id  not found in users and occupants table.", "data": obj });
                        let err = { "message": "identity id  not found in users and occupants table.", "data": obj }
                        reject(err);
                    }
                } else {
                    console.log("dynamoDBTriggerStream", { "message": "identity id  not found.", "data": obj });
                    let err = { "message": "identity id  not found.", "data": obj }
                    reject(err);
                }
            } else {
                console.log("dynamoDBTriggerStream", { "message": "data not found.", "data": obj });
                let err = { "message": "data not found.", "data": obj }
                reject(err);
            }
        } else {
            let err = { "message": "Type or table not equal to 'remove' or 'UserToDeviceList' respectively.", "data": obj }
            reject(err);
        }



    })
}

module.exports = {
    manage
}