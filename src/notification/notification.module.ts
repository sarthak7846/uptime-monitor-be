import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { EmailNotificationWorker } from './email-notification.worker';
import { EmailModule } from 'src/email/email.module';
import { NotificationController } from './notification.controller';

@Module({
  imports: [EmailModule],
  controllers: [NotificationController],
  providers: [NotificationService, EmailNotificationWorker],
  exports: [NotificationService],
})
export class NotificationModule {}
