import { Injectable, Logger } from '@nestjs/common';
import { NotificationEndpoint, NotificationRule } from '@prisma/client';
import { EmailService } from 'src/email/email.service';
import {
  NotificationEvent,
  NotificationEventType,
} from 'src/shared/events/notification-event.types';

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name, {
    timestamp: true,
  });
  constructor(private readonly emailService: EmailService) {}

  async handleEmailRule(
    rule: NotificationRule & { endpoint: NotificationEndpoint },
    payload: NotificationEvent,
  ) {
    const { subject, html } = this.buildEmailContent(payload);
    const email = (rule?.endpoint?.config as { email?: string }).email;
    if (!email) {
      this.logger.warn(`Skipping rule ${rule.id}: EMAIL endpoint missing config.email`);
      return;
    }

    await this.emailService.sendEmail({
      to: [email],
      html,
      subject,
    });
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
