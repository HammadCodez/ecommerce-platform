import Redis from 'ioredis';
import logger from '../utils/logger';

const { REDIS_URL } = process.env;

if (!REDIS_URL) {
  logger.error('REDIS_URL environment variable not defined');
  process.exit(1);
}

export const redis = new Redis(REDIS_URL, {  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    if (times > 3) {
      logger.error('Redis max retries reached. Giving up.');
      return null;
    }
    const delay = Math.min(times * 200, 2000);
    logger.warn(`Redis retry attempt ${times}. Retrying in ${delay}ms`);
    return delay;
  },
});

redis.on('connect', () => {
  logger.info('Redis connected successfully');
});

redis.on('error', (err: Error) => {
  logger.error(`Redis error: ${err.message}`);
});

redis.on('reconnecting', () => {
  logger.warn('Redis reconnecting...');
});

