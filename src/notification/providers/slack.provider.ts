import { Injectable, Logger } from '@nestjs/common';
import { NotificationEndpoint, NotificationRule } from '@prisma/client';
import axios from 'axios';
import { NotificationEvent } from 'src/shared/events/notification-event.types';

@Injectable()
export class SlackNotificationProvider {
  private readonly logger = new Logger(SlackNotificationProvider.name, {
    timestamp: true,
  });

  async send(
    rule: NotificationRule & { endpoint: NotificationEndpoint },
    payload: NotificationEvent,
  ) {
    try {
      const webhookUrl = (rule.endpoint.config as { webhookUrl: string }).webhookUrl;
      if (!webhookUrl) {
        this.logger.warn('SLACK endpoint missing config.webhookUrl. Skipping rule.');
        return;
      }
      const { monitorName, url, currentStatus, previousStatus, responseTime, errorMessage } =
        payload.data;

      const isDown = currentStatus === 'DOWN';

      await axios.post(webhookUrl, {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: isDown ? `🔴 ${monitorName} is DOWN` : `🟢 ${monitorName} is UP`,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*URL*\n${url}`,
              },
              {
                type: 'mrkdwn',
                text: `*Status*\n${previousStatus} → ${currentStatus}`,
              },
            ],
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Response Time*\n${responseTime ?? 'N/A'} ms`,
              },
              {
                type: 'mrkdwn',
                text: `*Occurred At*\n${new Date(payload.occurredAt).toLocaleString()}`,
              },
            ],
          },
          ...(errorMessage
            ? [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `*Error*\n\`\`\`${errorMessage}\`\`\``,
                  },
                },
              ]
            : []),
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Monitor ID: ${payload.monitorId}`,
              },
            ],
          },
        ],
      });

      this.logger.log('SLACK endpoint notification triggered');
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }
}
