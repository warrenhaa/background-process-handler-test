const {
    Constant,
} = require('../Constants')
var redisClient = require('./redisClient');
const Logger = require('../Logger');
const models = require('../models');
const { getOneFromCache, setInCache } = require('./Cache');
const { LONG_CACHE_EXPIRY } = require('../services/Constants');

async function setCompaniesCodeMapToCache(companies) {
  const { code } = companies;
  const companyId = companies.id;
  let key = 'constants'
  let constants = await Constant(key)
  await redisClient.hmset(constants.COMPANY_CODES, code, companyId);
  redisClient.expire(constants.COMPANY_CODES, LONG_CACHE_EXPIRY);
}

async function getCompanyCodeFromCache(code) {
  let key = 'constants'
  let constants = await Constant(key)
  const companyId = await redisClient.hget(constants.COMPANY_CODES, code);
  return companyId;
}

async function getCompany(company_id, code) {
  // console.log("🚀 ~ getCompany ~ code:", code,company_id)
  return new Promise(async (resolve, reject) => {
    try {
      let company = null;
      let where = {};

      where = (company_id) ? { id: company_id } : { code: code };
      // console.log("🚀 ~ returnnewPromise ~ where:", where)
      if (company_id) {
        company = await getOneFromCache("Companies", company_id);
      }
      if (!company && code) {
        // console.log("🚀 ~ returnnewPromise ~ code:", code)
        company = await getOneFromCache("Companies", code);
      }

      if (!company) {
        company = await models.companies.findOne({
          include: [{ model: models.addresses }],
          where: where,
          order: [[models.addresses, 'created_at', 'asc']],
        });
        
        if (!company) {
          Logger.info("Info-Error", { "message": "company_id/code is wrong, company not found in postgres db.", value: (company_id) ? company_id : code });
          reject(new Error("company_id/code is wrong, company not found in postgres db."));
        }

        // Set fetched company data into cache
        if (company_id) {
          await setInCache("Companies", company_id, company);
        }
        if (code) {
          await setInCache("Companies", code, company);
        }
      }
      resolve(company ? company : null);
    } catch (error) {
      reject(error);
    }
  });
}


module.exports = { getCompanyCodeFromCache, setCompaniesCodeMapToCache, getCompany };
