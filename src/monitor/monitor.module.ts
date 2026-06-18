import { Module } from '@nestjs/common';
import { MonitorController } from './monitor.controller';
import { MonitorService } from './monitor.service';
import { NotificationModule } from 'src/notification/notification.module';
import { RedisModule } from 'src/redis/redis.module';
import { MonitorSubscriberService } from './monitor-subscriber.service';
import { MonitorStreamService } from './monitor-stream.service';

@Module({
  imports: [NotificationModule, RedisModule],
  controllers: [MonitorController],
  providers: [MonitorService, MonitorSubscriberService, MonitorStreamService],
  exports: [MonitorService],
})
export class MonitorModule {}
