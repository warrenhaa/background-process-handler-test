import { LONG_CACHE_EXPIRY } from '../services/Constants';

var Constants = require('../Constants');
var redisClient = require('./redisClient');

async function setLocationsToCache(id, locations) {
  await redisClient.hmset(Constants.LOCATIONS, `${id}`, JSON.stringify(locations));
  redisClient.expire(Constants.LOCATIONS, LONG_CACHE_EXPIRY);
}

async function getLocationsFromCache(req) {
  let data = null;
  const id = req.body.company_id;
  const containerId = req.query.container_id || null;
  await redisClient.hgetall(Constants.LOCATIONS, (error, cachedData) => {
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

export { setLocationsToCache, getLocationsFromCache };
