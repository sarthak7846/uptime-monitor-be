import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationEndpoint, NotificationEventOutbox, NotificationRule } from '@prisma/client';
import { Worker } from 'bullmq';
import { NotificationService } from 'src/notification/notification.service';
import { EmailProvider } from 'src/notification/providers/email.provider';
import { SlackNotificationProvider } from 'src/notification/providers/slack.provider';
import { RedisService } from 'src/redis/redis.service';
import { NotificationEvent } from 'src/shared/events/notification-event.types';

@Injectable()
export class NotificationWorker implements OnModuleInit, OnModuleDestroy {
  private worker: Worker;
  private readonly logger = new Logger(NotificationWorker.name, {
    timestamp: true,
  });

  constructor(
    private readonly redisService: RedisService,
    private readonly notificationService: NotificationService,
    private readonly emailProvider: EmailProvider,
    private readonly slackNotificationProvider: SlackNotificationProvider,
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      'notification-send',
      async (job) => {
        await this.processJob(job);
      },
      {
        connection: this.redisService.bullmq,
      },
    );
    this.logger.log('Notification worker started running');
  }

  async onModuleDestroy() {
    await this.worker.close();
  }

  private async processJob(job: { data: { outboxId: string } }) {
    console.log('Processing notification event');
    const { outboxId } = job.data;
    const event = await this.notificationService.getNotificationEvent(outboxId);
    if (!event || event.status !== 'PENDING') return;

    await this.handleEvent(event);
  }

  private async handleEvent(event: NotificationEventOutbox) {
    const payload = JSON.parse(event.payload as string) as NotificationEvent;

    const rules = (await this.notificationService.getNotificationRules(
      {
        userId: payload.userId,
        enabled: true,
        events: { has: payload.type },
        OR: [{ monitorId: payload.monitorId }, { monitorId: null }],
      },
      {
        endpoint: true,
      },
    )) as Array<NotificationRule & { endpoint: NotificationEndpoint }>;

    for (const rule of rules) {
      const channel = (rule as NotificationRule & { endpoint: NotificationEndpoint }).endpoint
        ?.channel;

      if (channel === 'EMAIL') {
        await this.emailProvider.handleEmailRule(rule, payload);
      } else if (channel === 'SLACK') {
        await this.slackNotificationProvider.send(rule, payload);
      }
    }

    await this.notificationService.updateNotificationEvent(
      { id: event.id },
      {
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    );

    this.logger.log('Updated outbox state to PROCESSED');
  }
}
