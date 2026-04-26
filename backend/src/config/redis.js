const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

redis.on('error', (err) => console.error('[Redis] error:', err.message));
redis.on('connect', () => console.log('[Redis] connected'));

module.exports = redis;
