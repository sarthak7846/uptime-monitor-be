import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { RealtimeStreamService } from './realtime-stream.service';

@Injectable()
export class RealtimeSubscriberService {
    constructor(
        private readonly redis: RedisService,
        private readonly realtimeStreamService: RealtimeStreamService
    ) {}

    async onModuleInit() {
        await this.redis.sub.psubscribe('*');

        this.redis.sub.on('pmessage', (_, channel, message) => {
            const userId = channel.split(':')[1];
            const data = JSON.parse(message);
            this.realtimeStreamService.emit(data, userId);
        })
    }
}
