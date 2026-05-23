import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class ResendEmailProvider {
  private readonly resend: Resend;
  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get('RESEND_API_KEY');
    this.resend = new Resend(apiKey);
  }

  async send({
    to,
    subject,
    html,
  }: {
    to: string[];
    subject: string;
    html: string;
  }) {
    const { data, error } = await this.resend.emails.send({
      from: 'Acme <onboarding@resend.dev>',
      to,
      subject,
      html
    });

    console.log('email sent', data);
    if(error) console.log('email not sent', error);
  }
}
