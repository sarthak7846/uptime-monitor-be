import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MonitorModule } from './monitor/monitor.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { NotificationModule } from './notification/notification.module';
import { EmailModule } from './email/email.module';
import { IncidentModule } from './incident/incident.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RealtimeStreamService } from './realtime/realtime-stream.service';
import { RealtimeSubscriberService } from './realtime/realtime-subscriber.service';
import { RedisModule } from './redis/redis.module';
import { StatusPageModule } from './status-page/status-page.module';
import { WorkerModule } from './worker/worker.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot(),
    MonitorModule,
    PrismaModule,
    UserModule,
    AuthModule,
    NotificationModule,
    RedisModule,
    EmailModule,
    IncidentModule,
    RealtimeModule,
    StatusPageModule,
    WorkerModule,
  ],
  controllers: [AppController],
  providers: [AppService, RealtimeStreamService, RealtimeSubscriberService],
})
export class AppModule {}
