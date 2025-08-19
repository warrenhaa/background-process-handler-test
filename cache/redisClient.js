const Redis = require('ioredis');
const redisClient = new Redis(process.env.REDIS_PORT, process.env.REDIS_HOST);
module.exports = redisClient;
