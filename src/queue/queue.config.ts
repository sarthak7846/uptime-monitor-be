import { Queue } from 'bullmq';
import { getRedisConnectionOptions } from 'src/redis/redis.config';

export const monitorQueue = new Queue('monitor-check', {
  connection: getRedisConnectionOptions(),
});