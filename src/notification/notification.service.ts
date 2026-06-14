import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationEvent } from 'src/shared/events/notification-event.types';
import { CreateNotificationEndpointDto, CreateNotificationRuleDto } from './notification.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name, {
    timestamp: true,
  });

  constructor(private readonly prisma: PrismaService) {}
  async emitNotification(event: NotificationEvent) {
    await this.prisma.notificationEventOutbox.create({
      data: {
        userId: event.userId,
        type: event.type,
        payload: JSON.stringify(event),
      },
    });
    this.logger.log('Emitted notification - Created entry in notificationEventOutbox');
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

  async getNotificationEndpoints(userId: string) {
    return this.prisma.notificationEndpoint.findMany({
      where: { userId },
      include: {
        rules: true,
      },
    });
  }

  async getNotificationRules(userId: string) {
    return this.prisma.notificationRule.findMany({
      where: { userId },
      include: {
        endpoint: true,
      },
    });
  }
}
