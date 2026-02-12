import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationEventOutbox } from '@prisma/client';
import { EmailService } from 'src/email/email.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class EmailNotificationWorker {
  private readonly logger = new Logger(EmailNotificationWorker.name, {
    timestamp: true,
  });
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  @Cron('*/10 * * * * *')
  async process() {
    this.logger.log('Finding pending notification events in outbox');
    const events = await this.prisma.notificationEventOutbox.findMany({
      where: { status: 'PENDING' },
      take: 10,
    });
    this.logger.log('Pending notification events in outbox', events);

    for (const event of events) {
      await this.handleEvent(event);
    }
  }

  private async handleEvent(event: NotificationEventOutbox) {
    const payload = JSON.parse(event.payload as any);

    const rules = await this.prisma.notificationRule.findMany({
      where: {
        userId: payload.userId,
        enabled: true,
        events: { has: payload.type },
        OR: [{ monitorId: payload.monitorId }, { monitorId: null }],
        endpoint: { channel: 'EMAIL' },
      },
      include: {
        endpoint: true,
      },
    });

    for (const rule of rules) {
      // Send email
      const email = (rule?.endpoint?.config as any).email ?? 'sarthakbehera10@gmail.com'

      await this.emailService.sendEmail({
        to: [email],
        html: '<p>Congrats on sending your <strong>first email</strong>!</p>',
        subject: 'Uptime Monitor Notification',
      });
    }

    //Update outbox state
    await this.prisma.notificationEventOutbox.update({
      where: { id: event.id },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    this.logger.log('Updated outbox state to PROCESSED');
  }
}
