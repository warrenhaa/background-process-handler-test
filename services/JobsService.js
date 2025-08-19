const models = require('../models');
const { Op } = models.Sequelize;

var createJob = function (type, status, input, company_id, createdBy, updatedBy, metadata = null,) {
    return new Promise(function (resolve, reject) {

        models.jobs.create({ type, status, input, company_id,  created_by: createdBy, updated_by: updatedBy, meta_data: metadata, })
            .then(result => {
                resolve(result)
            }).catch(err => {
                reject(err)
            })

    })
}

var updateJob = function (status, id) {
    return new Promise(function (resolve, reject) {
        models.jobs.update({ status }, {
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

var updateJobWithMetaData = function (status, metadata, id) {
    return new Promise(function (resolve, reject) {
        models.jobs.update({ status, meta_data:metadata }, {
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

module.exports = {
    createJob, updateJob, updateJobWithMetaData
}