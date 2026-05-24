import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MonitorWorker } from "src/worker/monitor.worker";
import { NotificationModule } from "src/notification/notification.module";
import { PrismaModule } from "src/prisma/prisma.module";
import { RedisModule } from "src/redis/redis.module";

@Module({
    imports: [
    ConfigModule.forRoot(),
      PrismaModule,
      NotificationModule,
      RedisModule
    ],
    providers: [
      MonitorWorker,
    ],
  })
  export class WorkerModule {}