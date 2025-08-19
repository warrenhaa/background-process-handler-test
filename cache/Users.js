var Constants = require('../Constants');
var redisClient = require('./redisClient');
const { LONG_CACHE_EXPIRY } = require('../services/Constants');

async function setCognitoToUserCache(userDetails) {
  const { cognitoId } = userDetails;
  const { companyId } = userDetails;
  const { userId } = userDetails;
  await redisClient.hmset(Constants.USERS_COGINTO, `${cognitoId}_${companyId}`, userId);
  redisClient.expire(Constants.USERS_COGINTO, LONG_CACHE_EXPIRY);
}

async function getCognitoToUserId(userDetails) {
  const { cognitoId } = userDetails;
  const { companyId } = userDetails;
  const userId = await redisClient.hget(Constants.USERS_COGINTO, `${cognitoId}_${companyId}`);
  return userId;
}

export { getCognitoToUserId, setCognitoToUserCache };
