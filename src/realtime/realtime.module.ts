import { Module } from '@nestjs/common';
import { RealtimeController } from './realtime.controller';
import { RealtimeStreamService } from './realtime-stream.service';
import { RealtimeSubscriberService } from './realtime-subscriber.service';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [RealtimeController],
  providers: [RealtimeStreamService, RealtimeSubscriberService],
})
export class RealtimeModule {}
