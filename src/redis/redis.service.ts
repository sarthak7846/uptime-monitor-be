import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { getRedisConnectionOptions } from './redis.config';

@Injectable()
export class RedisService implements OnModuleDestroy {
  public pub: IORedis;
  public sub: IORedis;
  /** Dedicated client for BullMQ workers (blocking commands). */
  public bullmq: IORedis;

  constructor(private configService: ConfigService) {
    const config = getRedisConnectionOptions(this.configService);

    this.pub = new IORedis(config);
    this.sub = new IORedis(config);
    this.bullmq = new IORedis(config);
  }

  async onModuleDestroy() {
    await Promise.all([this.pub.quit(), this.sub.quit(), this.bullmq.quit()]);
  }
}
