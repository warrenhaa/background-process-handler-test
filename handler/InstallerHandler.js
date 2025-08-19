const models = require('../models');
const { Entities } = require('../utils/Entities');
let { addActivityLog } = require('../services/ActivityLogService')
const { getCompany } = require('../cache/Companies');
var companyId = null
var getOccupant = function (email) {
    return new Promise(async (resolve, reject) => {
        models.occupants.findOne({
            where: {
                email: email
            }
        }).then(result => {
            resolve(result);
        }).catch(err => {
            reject(err)
        })
    })
}

//update devices
var updateOccupant = function (id, is_installer) {
    return new Promise((resolve, reject) => {
        models.occupants.update({
            is_installer: is_installer
        }, {
            where: { id: id }
        }).then(result => {
            resolve(result)
        }).catch(err => {
            reject(err)
        })
    })
}



var manage = function (obj) {
    return new Promise(async (resolve, reject) => {
        console.log("[INFO] InstallerQueue", obj)
        if (!companyId) {
            const company = await getCompany(null, process.env.COMPANY_CODE).then(result => {
                return (result);
            }).catch(err => {
                reject(err);
            });
            companyId = company.id;
        }
        if (obj.event_type) {
            if (obj.customer_email) {
                let occupant = await getOccupant(obj.customer_email).catch(err => {
                    reject(err)
                })
                if (!occupant) {
                    console.log("[INFO] InstallerQueue,customer not registered", obj)
                    await addActivityLog(Entities.installer.entity_name, Entities.installer.event_name.not_registered, obj, Entities.notes.event_name.added, companyId, companyId)
                } else {
                    if (obj.event_type == "customer.subscription.created") {
                        console.log("check condition->",obj.status , (obj.status == 'active' || obj.status == 'trialing'),(obj.status && (obj.status == 'active' || obj.status == 'trialing')))
                        if (obj.status && (obj.status == 'active' || obj.status == 'trialing')) {
                            //make occupants as  installer    
                            await updateOccupant(occupant.id, true).catch(err => {
                                reject(err)
                            })
                            await addActivityLog(Entities.installer.entity_name, Entities.installer.event_name.added, obj, Entities.notes.event_name.added, occupant.id, companyId)

                        } else {
                            //make occupants as not installer
                            await updateOccupant(occupant.id, false).catch(err => {
                                reject(err)
                            })
                            await addActivityLog(Entities.installer.entity_name, Entities.installer.event_name.deleted, obj, Entities.notes.event_name.added, occupant.id, companyId)

                        }

                    } else if (obj.event_type == "customer.subscription.updated") {
                        if (obj.status && (obj.status == 'active' || obj.status == 'trialing')) {
                            //make occupants as  installer  
                            updateOccupant(occupant.id, true).catch(err => {
                                reject(err)
                            })
                            await addActivityLog(Entities.installer.entity_name, Entities.installer.event_name.updated, obj, Entities.notes.event_name.added, occupant.id, companyId)

                        } else {
                            //make occupants as not installer
                            updateOccupant(occupant.id, false).catch(err => {
                                reject(err)
                            })
                            await addActivityLog(Entities.installer.entity_name, Entities.installer.event_name.deleted, obj, Entities.notes.event_name.added, occupant.id, companyId)

                        }
                    } else if (obj.event_type == "customer.subscription.deleted") {
                        //make occupants as not installer
                        await updateOccupant(occupant.id, false).catch(err => {
                            reject(err)
                        })
                        await addActivityLog(Entities.installer.entity_name, Entities.installer.event_name.deleted, obj, Entities.notes.event_name.added, occupant.id, companyId)

                    } else {
                        console.log("[INFO] InstallerQueue, not recognised obj.event_type found", obj)
                    }
                }
            } else {
                console.log("[INFO] InstallerQueue,customer_email not found", obj)
            }

        } else {
            console.log("[INFO] InstallerQueue, no obj.event_type found", obj)
        }
        resolve()
    })
}

module.exports = {
    manage
}