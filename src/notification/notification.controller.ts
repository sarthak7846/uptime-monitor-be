import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { NotificationService } from './notification.service';
import {
  CreateNotificationEndpointDto,
  CreateNotificationRuleDto,
  UpdateNotificationRuleDto,
} from './notification.dto';
import type { AuthenticatedRequest } from 'src/types/express';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('endpoint')
  async createNotificationEndpoint(
    @Body() createDto: CreateNotificationEndpointDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = request.user.sub;
    return this.notificationService.createNotificationEndpoint(createDto, userId);
  }

  @Post('rule')
  async createNotificationRule(
    @Body() createDto: CreateNotificationRuleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = request.user.sub;
    return await this.notificationService.createNotificationRule(createDto, userId);
  }

  @Patch('rule/:id')
  async updateNotificationRule(
    @Body() updateDto: UpdateNotificationRuleDto,
    @Req() request: AuthenticatedRequest,
    @Param('id') ruleId: string,
  ) {
    const userId = request.user.sub;
    return await this.notificationService.updateNotificationRule(updateDto, ruleId, userId);
  }

  @Get('endpoints')
  async getNotificationEndpoints(@Req() request: AuthenticatedRequest) {
    const userId = request.user.sub;
    return await this.notificationService.getNotificationEndpoints(userId);
  }

  @Get('rules')
  async getNotificationRules(@Req() request: AuthenticatedRequest) {
    const userId = request.user.sub;
    return await this.notificationService.getNotificationRules({ userId });
  }

  @Get('rules/:endpointId')
  async getRulesOfEndpoint(
    @Req() request: AuthenticatedRequest,
    @Param('endpointId') endpointId: string,
  ) {
    const userId = request.user.sub;
    return await this.notificationService.getRulesOfEndpoint(userId, endpointId);
  }
}
