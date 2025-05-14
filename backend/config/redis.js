const Redis = require('ioredis');
const { promisify } = require('util');

const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('Redis Client Connected');
});

// Cache middleware
const cache = (duration) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const key = `cache:${req.originalUrl || req.url}`;
    
    try {
      const cachedResponse = await redisClient.get(key);
      
      if (cachedResponse) {
        return res.json(JSON.parse(cachedResponse));
      }
      
      res.originalJson = res.json;
      res.json = (body) => {
        redisClient.setex(key, duration, JSON.stringify(body));
        res.originalJson(body);
      };
      
      next();
    } catch (error) {
      console.error('Cache Error:', error);
      next();
    }
  };
};

// Cache invalidation helper
const invalidateCache = async (pattern) => {
  try {
    const keys = await redisClient.keys(`cache:${pattern}`);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.error('Cache Invalidation Error:', error);
  }
};

module.exports = {
  redisClient,
  cache,
  invalidateCache
}; 