const models = require('../models');
const redisClient = require('../cache/redisClient');
const LONG_CACHE_EXPIRY = 7776000;
const SHORT_CACHE_EXPIRY = 86400;

async function setConstantToCache(cacheKey, key, constants) {
  await redisClient.hmset(cacheKey, key, JSON.stringify(constants)); // Store the constants as a JSON string
  redisClient.expire(cacheKey, LONG_CACHE_EXPIRY);
}

async function getConstantFromCache(cacheKey, key) {
  const cachedConstantsString = await redisClient.hget(cacheKey, key);
  return cachedConstantsString; // Return null if not found in cache
}

const data = function (key) {
    return new Promise(async (resolve, reject) => {
        try {
            const cacheKey = "constants";
            let cachedConstants = await getConstantFromCache(cacheKey, key);

            if (!cachedConstants) {
                const constantsFromDB = await models.configs.findOne({ where: { key } });
                if (constantsFromDB) {
                    const constantsData = constantsFromDB.dataValues.value;
                    await setConstantToCache(cacheKey, key, constantsData);
                    cachedConstants = await getConstantFromCache(cacheKey, key);
                    // console.log("🚀 ~ file: Constants.js:27 ~ returnnewPromise ~ cachedConstants:", cachedConstants)
                } else {
                    reject("Constants not found in the database.");
                    return;
                }
            }
            cachedConstants = JSON.parse(cachedConstants)
            resolve(cachedConstants);
        } catch (err) {
            reject(err);
        }
    });
};

module.exports = { data, LONG_CACHE_EXPIRY, SHORT_CACHE_EXPIRY };
