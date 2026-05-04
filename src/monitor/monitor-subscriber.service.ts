import { Injectable, OnModuleInit } from "@nestjs/common";
import { RedisService } from "src/redis/redis.service";
import { MonitorStreamService } from "./monitor-stream.service";

@Injectable()
export class MonitorSubscriberService implements OnModuleInit {
    constructor(
        private readonly redis: RedisService,
        private readonly monitorStream: MonitorStreamService
    ) {}

    async onModuleInit() {
        await this.redis.sub.psubscribe('monitor-updates:*');

        this.redis.sub.on('pmessage', (pattern, channel, message) => {
            const data = JSON.parse(message);
            this.monitorStream.emit(data);
        })
    }
}