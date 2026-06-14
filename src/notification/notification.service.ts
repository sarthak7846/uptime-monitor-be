import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationEvent } from 'src/shared/events/notification-event.types';
import { CreateNotificationEndpointDto, CreateNotificationRuleDto } from './notification.dto';
import { notificationQueue } from 'src/queue/queue.config';
import { Prisma } from '@prisma/client';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name, {
    timestamp: true,
  });

  constructor(private readonly prisma: PrismaService) {}
  async emitNotification(event: NotificationEvent) {
    try {
      this.logger.log('Creating entry in notification event outbox');

      const row = await this.prisma.notificationEventOutbox.create({
        data: {
          userId: event.userId,
          type: event.type,
          payload: JSON.stringify(event),
        },
      });

      await notificationQueue.add(
        'deliver-notification',
        {
          outboxId: row.id,
        },
        {
          removeOnComplete: true,
        },
      );
      this.logger.log('Emitted notification - Created entry in notificationQueue');
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  async createNotificationEndpoint(createDto: CreateNotificationEndpointDto, userId: string) {
    return this.prisma.notificationEndpoint.create({
      data: {
        userId,
        channel: createDto.channel,
        config: createDto.config,
      },
    });
  }

  async createNotificationRule(createDto: CreateNotificationRuleDto, userId: string) {
    return this.prisma.notificationRule.create({
      data: {
        userId,
        endpointId: createDto.endpointId,
        monitorId: createDto.monitorId || null,
        events: createDto.events,
        enabled: createDto.enabled ?? true,
      },
    });
  }

  async getNotificationEvent(outboxId: string) {
    return this.prisma.notificationEventOutbox.findUnique({ where: { id: outboxId } });
  }

  async updateNotificationEvent(
    where: { id: string },
    data: Prisma.NotificationEventOutboxUpdateInput,
  ) {
    return this.prisma.notificationEventOutbox.update({
      where,
      data,
    });
  }

  async getNotificationEndpoints(userId: string) {
    const endpoints = await this.prisma.notificationEndpoint.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            rules: true,
          },
        },
      },
    });

    return endpoints.map(({ _count, ...endpoint }) => ({
      ...endpoint,
      ruleCount: _count.rules,
    }));
  }

  async getNotificationRules(
    where: Prisma.NotificationRuleWhereInput,
    include?: Prisma.NotificationRuleInclude,
  ) {
    return this.prisma.notificationRule.findMany({
      where,
      include,
    });
  }

  async getRulesOfEndpoint(userId: string, endpointId: string) {
    return this.prisma.notificationRule.findMany({
      where: {
        userId,
        endpointId,
      },
    });
  }
}
