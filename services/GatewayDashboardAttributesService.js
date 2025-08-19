const models = require('../models');
var lodash = require('lodash');
const {addActivityLog} = require('./ActivityLogService');
const {Constant} = require('../Constants')
const {Entities} = require('../utils/Entities')
const mudder = require('mudder');
const { getCompany } = require('../cache/Companies');

const {
    Op,
} = models.Sequelize;

var getRandomGridOrder = function () {
    const hexstrings = mudder.base62.mudder('0', 'z', 10000);
    const random = Math.floor(Math.random() * hexstrings.length);
    return hexstrings[random];
}

var getAllDevicesOfGateway = async function (gateway_id) {
    const getAllDevicesOfGateways = await models.devices.findAll({
        where: {
            gateway_id,
        },
    }).then((result) => {
        const deviceIdLists = [];
        if (result && result.length > 0) {
            for (const element in result) {
                const data = result[element];
                deviceIdLists.push(data.id);
            }
        }
        return (deviceIdLists);
    }).catch((error) => {
        reject(error);
    });
    return getAllDevicesOfGateways;
}
var getlinkedCompanies = async function (company_id) {
    return new Promise(async (resolve, reject) => {
        const company = await getCompany(company_id).then(result => {
            return (result);
        }).catch(err => {
            reject(err);
        });
        let linkedCompanies = [];
        if (company.linked_companies) {
            linkedCompanies = company.linked_companies.split(',');
        }
        linkedCompanies.push(company.code);
        const companies = await models.companies.findAll({
            where: { code: { [Op.in]: linkedCompanies } },
        });
        linkedCompanies = lodash.map(companies, 'id');
        resolve(linkedCompanies);
    });
}
var getOccupantsDashboardAttributes = async function (id, occupant_id, company_id, item_id, type) {
    const linkedCompanies = await getlinkedCompanies(company_id);
    const where = { occupant_id, company_id: { [Op.in]: linkedCompanies } };
    if (!id) {
        where.item_id = item_id;
    } else {
        where.id = id;
    }
    if (type) {
        where.type = type;
    }
    const getData = await models.occupants_dashboard_attributes.findOne({
        attributes: ['id', 'type', 'grid_order'],
        where,
    }).then((result) => result).catch((err) => {
        reject(err);
    });
    return getData;
}
var AddorUpdateOccupantsDashboardAttributes = function (body, company_id, occupant_id, job_id) {
    return new Promise(async (resolve, reject) => {
        const { item_id, type, grid_order } = body;
        const dashboardAttributeObj = {
            item_id, type, grid_order, occupant_id, company_id,
        };
        const dashboardAttributes = await getOccupantsDashboardAttributes(null, occupant_id, company_id, item_id, type).catch(err => {

        });
        if (!dashboardAttributes) {
            const addDashboardAttributes = await models.occupants_dashboard_attributes.create(dashboardAttributeObj)
                .catch((err) => {
                    console.log(err);
                    reject(err);
                });
            const Obj = {
                old: {},
                new: addDashboardAttributes,
            };
            addActivityLog(Entities.occupantsGatewayDashboardAttributesJob.entity_name, Entities.occupants_dashboard_attributes.event_name.added,
                Obj, Entities.notes.event_name.added, job_id, addDashboardAttributes.company_id, null, occupant_id, null);
            // const dashboardAttributes = await this.getOccupantsDashboardAttributes(null, occupant_id, company_id, item_id, type);
            resolve(dashboardAttributes);
        } else {
            const updateDashboardAttributes = await models.occupants_dashboard_attributes.update(
                { grid_order },
                {
                    where: {
                        item_id, type, company_id, occupant_id,
                    },
                    returning: true,
                },
            ).catch((error) => {
                reject(error);
            });
            const oldObj = { grid_order: dashboardAttributes.grid_order };
            const newObj = { grid_order };
            const obj = {
                old: oldObj,
                new: newObj,
            };
            addActivityLog(Entities.occupantsGatewayDashboardAttributesJob.entity_name, Entities.occupants_dashboard_attributes.event_name.updated,
                obj, Entities.notes.event_name.updated, job_id, company_id, null, occupant_id, null);
            // const dashboardAttributesobj = await this.getOccupantsDashboardAttributes(null, occupant_id, company_id, item_id, type);
            resolve(updateDashboardAttributes);
        }


    })

}
var manage = function (obj) {
    return new Promise(async (resolve, reject) => {
        const gatewayId = obj.input.gateway_id;
        const receiverOccupantId = obj.input.receiver_occupant_id;
        const companyId = obj.companyId
        const jobId = obj.jobId
        const devicesList = await getAllDevicesOfGateway(gatewayId);
        if (devicesList && devicesList.length > 0) {
            var promiseList = []
            for (const element of devicesList) {
                const input = {
                    item_id: element,
                    type: 'device',
                    grid_order: await getRandomGridOrder(),
                };
                promiseList.push(AddorUpdateOccupantsDashboardAttributes(input, companyId, receiverOccupantId, jobId))
            }
            Promise.all(promiseList).catch(err => {
                reject(err)
            })
            addActivityLog(Entities.occupantsGatewayDashboardAttributesJob.entity_name, Entities.occupantsGatewayDashboardAttributesJob.event_name.job, obj, "dashboard attributes added for the gateway devices.", jobId, companyId)
            resolve()

        } else {

            addActivityLog(Entities.occupantsGatewayDashboardAttributesJob.entity_name, Entities.occupantsGatewayDashboardAttributesJob.event_name.job, obj, "No devices found for this gateway.", jobId, companyId)
            resolve()
        }
        // find all the devices assigned to room location

    })
}
module.exports = {
    manage
}