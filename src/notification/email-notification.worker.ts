import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationEventOutbox } from '@prisma/client';
import { EmailService } from 'src/email/email.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  NotificationEvent,
  NotificationEventType,
} from 'src/shared/events/notification-event.types';

@Injectable()
export class EmailNotificationWorker {
  private readonly logger = new Logger(EmailNotificationWorker.name, {
    timestamp: true,
  });
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // @Cron('*/10 * * * * *')
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
    const payload = JSON.parse(event.payload as string) as NotificationEvent;

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

    const { subject, html } = this.buildEmailContent(payload);

    for (const rule of rules) {
      const email = (rule?.endpoint?.config as { email?: string }).email;
      if (!email) {
        this.logger.warn(`Skipping rule ${rule.id}: EMAIL endpoint missing config.email`);
        continue;
      }

      await this.emailService.sendEmail({
        to: [email],
        html,
        subject,
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

  private buildEmailContent(payload: NotificationEvent): {
    subject: string;
    html: string;
  } {
    const isDown = payload.type === NotificationEventType.MONITOR_DOWN;
    const { monitorName, url, currentStatus, previousStatus, responseTime, errorMessage } =
      payload.data;
    const occurredAt = new Date(payload.occurredAt).toLocaleString();

    const statusLabel = isDown ? 'Down' : 'Recovered';
    const accentColor = isDown ? '#dc2626' : '#16a34a';
    const headline = isDown ? `${monitorName} is unreachable` : `${monitorName} is back online`;

    const detailRows = [
      ['Monitor', monitorName],
      ['URL', url],
      ['Status', `${previousStatus} → ${currentStatus}`],
      ['Detected at', occurredAt],
      ...(responseTime != null ? [['Response time', `${responseTime} ms`] as const] : []),
      ...(isDown && errorMessage ? [['Reason', errorMessage] as const] : []),
    ];

    const detailsHtml = detailRows
      .map(
        ([label, value]) =>
          `<tr>
            <td style="padding:8px 12px;color:#6b7280;font-size:14px;vertical-align:top;">${this.escapeHtml(label)}</td>
            <td style="padding:8px 12px;color:#111827;font-size:14px;">${this.escapeHtml(value)}</td>
          </tr>`,
      )
      .join('');

    const summary = isDown
      ? `Your monitor <strong>${this.escapeHtml(monitorName)}</strong> failed a health check and is currently <strong>DOWN</strong>.`
      : `Your monitor <strong>${this.escapeHtml(monitorName)}</strong> is responding again and is <strong>UP</strong>.`;

    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#111827;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:${accentColor};">
          ${statusLabel}
        </p>
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${this.escapeHtml(headline)}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#374151;">${summary}</p>
        <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;">
          ${detailsHtml}
        </table>
        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
          Uptime Monitor · Incident ${this.escapeHtml(payload.incidentId)}
        </p>
      </div>
    `.trim();

    return {
      subject: `[${statusLabel.toUpperCase()}] ${monitorName}`,
      html,
    };
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
