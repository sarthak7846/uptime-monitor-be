import { PartialType } from '@nestjs/mapped-types';
import { NotificationChannel } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateNotificationEndpointDto {
  @IsEnum(['EMAIL', 'SLACK', 'WEBHOOK'])
  channel: NotificationChannel;

  @IsObject()
  config: Record<string, any>; // Channel-specific config (e.g., { email: "user@example.com" } or { webhookUrl: "https://..." })
}

export class CreateNotificationRuleDto {
  @IsString()
  endpointId: string;

  @IsString()
  @IsOptional()
  monitorId?: string | null; // null = all monitors

  @IsArray()
  @IsString({ each: true })
  @IsIn(['monitor.down', 'monitor.up'], { each: true })
  events: string[]; // ['monitor.down', 'monitor.up']

  @IsBoolean()
  @IsOptional()
  enabled?: boolean; // defaults to true
}

export class UpdateNotificationRuleDto extends PartialType(CreateNotificationRuleDto) {}
