import { Injectable, OnModuleDestroy } from "@nestjs/common";
import IORedis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
    public pub: IORedis;
    public sub: IORedis;

    constructor() {
        const config = {
            host: 'localhost',
            port: 6379
        };

        this.pub = new IORedis(config);
        this.sub = new IORedis(config);
    }

    async onModuleDestroy() {
        await this.pub.quit();
        await this.sub.quit();
    }
}