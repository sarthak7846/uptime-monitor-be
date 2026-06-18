import { ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';

export function getRedisConnectionOptions(configService?: ConfigService): RedisOptions {
  const host = configService ? configService.get<string>('REDIS_HOST') : process.env.REDIS_HOST;
  const port = Number(
    configService ? configService.get<string>('REDIS_PORT') : process.env.REDIS_PORT,
  );
  const password = configService
    ? configService.get<string>('REDIS_PASSWORD')
    : process.env.REDIS_PASSWORD;

  return {
    host,
    port,
    password,
    maxRetriesPerRequest: null,
    tls: {},
  };
}
