import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { EmailModule } from 'src/email/email.module';
import { NotificationController } from './notification.controller';
import { EmailProvider } from './providers/email.provider';

@Module({
  imports: [EmailModule],
  controllers: [NotificationController],
  providers: [NotificationService, EmailProvider],
  exports: [NotificationService, EmailProvider],
})
export class NotificationModule {}
