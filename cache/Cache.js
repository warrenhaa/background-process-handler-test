var lodash = require('lodash');
var redisClient = require('./redisClient');
const {
  Constant
} = require('../Constants')
const Logger = require('../Logger');
const { SHORT_CACHE_EXPIRY } = require('../services/Constants');

redisClient.on('connect', () => {
  console.info('Redis Connected cache.js'); //
});

async function setInCache(cacheKey, id, valueMappings, expireAfter = SHORT_CACHE_EXPIRY) {
  await redisClient.hmset(
    `${cacheKey}`,
    `${id}`,
    JSON.stringify(valueMappings),
  );

  redisClient.expire(`${cacheKey}`, expireAfter);

}

async function getAllFromCache(cacheKey) {
  let data = null;
  await redisClient.hgetall(`${cacheKey}`, (error, cachedData) => {
    data = [];

    if (error) {
      data = null;
    }
    if (cachedData != null) {
      Object.keys(cachedData).forEach((key) => {
        data.push(JSON.parse(cachedData[key]));
      });
    }
    return data;
  });
  return data;
}

async function deleteFromCache(cacheKey, id) {
  await redisClient.hdel(`${cacheKey}`, `${id}`);
}

async function deleteFromCacheUsingKey(cacheKey) {
  await redisClient.del(`${cacheKey}`);
}

async function getOneFromCache(cacheKey, id) {
  let dataValues = null;
  await redisClient.hget(`${cacheKey}`, `${id}`, (error, cachedData) => {
    if (error) {
      Logger.error("Error", { "stack": error.stack, "msg": error.message })
      dataValues = null;
    }
    if (cachedData != null) {
      dataValues = JSON.parse(cachedData);
    }
  });
  return dataValues;
}

async function getLocationsFromCache(req) {
  let data = null;
  const id = req.body.company_id;
  let key = 'constants'
  let constants = await Constant(key)
  const containerId = req.query.container_id || null;
  await redisClient.hgetall(constants
    .LOCATIONS, (error, cachedData) => {
      data = [];

      if (error) {
        data = null;
      }
      if (cachedData != null) {
        Object.keys(cachedData).forEach((key) => {
          const companyId = JSON.parse(cachedData[key]).company_id;
          const containerIdFromCache = JSON.parse(cachedData[key]).container_id;
          if (companyId === id) {
            if (containerId) {
              if (containerIdFromCache === containerId) {
                data.push(JSON.parse(cachedData[key]));
              }
            } else {
              data.push(JSON.parse(cachedData[key]));
            }
          }
        });
      }
      return data;
    });
  return data;
}

async function getLocationTypesFromCache(req) {
  let data = null;
  const id = req.body.company_id;
  let key = 'constants'
  let constants = await Constant(key)
  await redisClient.hgetall(constants
    .LOCATION_TYPES, (error, cachedData) => {
      data = [];

      if (error) {
        data = null;
      }
      if (cachedData != null) {
        Object.keys(cachedData).forEach((key) => {
          const companyId = JSON.parse(cachedData[key]).company_id;
          if (companyId === id) {
            data.push(JSON.parse(cachedData[key]));
          }
        });
      }
      return data;
    });
  return data;
}

async function setCompaniesCodeMapToCache(companies) {
  const { code } = companies;
  const companyId = companies.id;
  let key = 'constants'
  let constants = await Constant(key)
  await redisClient.hmset(constants
    .COMPANY_CODES, code, companyId);
  redisClient.expire(Constants
    .COMPANY_CODES, 7776000);
}

async function getCompanyCodeFromCache(code) {
  let key = 'constants'
  let constants = await Constant(key)
  const companyId = await redisClient.hget(constants
    .COMPANY_CODES, code);
  return companyId;
}

async function setActivityConfigsOfCompany(companyId, entity, data) {
  let key = 'constants'
  let constants = await Constant(key)
  await redisClient.hmset(
    `${constants
      .ACTIVITY_CONFIGS}`, `${companyId}:${entity}`,
    JSON.stringify(data),
  );
  redisClient.expire(`${constants
    .ACTIVITY_CONFIGS}`, 7776000);
}

async function getActivityConfigsOfCompany(companyId, entity) {
  let key = 'constants'
  let constants = await Constant(key)
  const configs = await redisClient.hget(`${constants
    .ACTIVITY_CONFIGS}`, `${companyId}:${entity}`);
  return configs ? JSON.parse(configs) : null;
}

async function getAllDevicesOfLocationFromCache(req) {
  let data = null;
  const companyId = req.body.company_id;
  let key = 'constants'
  let constants = await Constant(key)
  const locationId = req.params.id;
  await redisClient.hgetall(constants
    .DEVICES, (error, cachedData) => {
      data = [];

      if (error) {
        data = null;
      }
      if (cachedData != null) {
        const allDevices = Object.values(cachedData).map((value) => JSON.parse(value));
        const devicesOfCompany = lodash.filter(allDevices, [
          'company_id',
          companyId,
        ]);
        data = lodash.filter(devicesOfCompany, [
          'location_id',
          locationId,
        ]);
      }
      return data;
    });
  return data;
}
const setDataWithDateCacheKey = function (cacheKey, dateOnetouchId, value, expiryInSeconds) {
  return new Promise(async (resolve, reject) => {
    const multi = redisClient.multi();
    const expiryTimeInSeconds = Math.floor(expiryInSeconds);
    multi.hset(cacheKey, dateOnetouchId, JSON.stringify(value));
    multi.expire(cacheKey, expiryTimeInSeconds);
    multi.incr(cacheKey + '_count');
    multi.exec(async (err, replies) => {
      if (err) {
        reject(err);
      } else {
        const expiryTime = Date.now() + (Math.floor(expiryInSeconds) * 1000);
        await redisClient.expireat(cacheKey + '_count', Math.floor(expiryTime / 1000));
        resolve(replies);

      }
    });
  })
}

const getIncreament = function (key) {
  return new Promise(async (resolve, reject) => {
    const countKey = key + '_count';
    await redisClient.incr(countKey, (incrErr, newCount) => {
      if (incrErr) {
        console.error('Error incrementing count:', incrErr);
        resolve(0)
      } else {
        // console.log('Count incremented to:', newCount);
        if (newCount === 1) {
          redisClient.expire(countKey, SHORT_CACHE_EXPIRY, (expireErr) => {
            if (expireErr) {
              console.error('Error setting TTL:', expireErr);
            }
             resolve(newCount);
          });
        } else {
           resolve(newCount);
        }
      }
    })
  })
}
module.exports = {
  setInCache,
  deleteFromCache,
  getOneFromCache,
  getAllFromCache,
  getLocationsFromCache,
  getLocationTypesFromCache,
  getCompanyCodeFromCache,
  setCompaniesCodeMapToCache,
  setActivityConfigsOfCompany,
  getActivityConfigsOfCompany,
  getAllDevicesOfLocationFromCache,
  deleteFromCacheUsingKey, setDataWithDateCacheKey, getIncreament
};
