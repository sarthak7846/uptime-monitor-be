import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Sse,
} from '@nestjs/common';
import { MonitorService } from './monitor.service';
import { CreateMonitorDto } from './create-monitor.dto';
import { UpdateMonitorDto } from './update-monitor.dto';
import type { AuthenticatedRequest } from 'src/types/express';
import { Public } from 'src/auth/public.decorator';
import { interval, map } from 'rxjs';
import { MonitorStreamService } from './monitor-stream.service';

@Controller('monitor')
export class MonitorController {
  constructor(private readonly monitorService: MonitorService,
    private readonly monitorStream: MonitorStreamService
  ) {}

  @Get('/all')
  async getAllMonitors() {
    const res = await this.monitorService.getAllMonitors();
    return res;
  }

  @Post()
  async createMonitor(
    @Body() createMonitorDto: CreateMonitorDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = request.user.sub;
    const res = await this.monitorService.createMonitor(
      createMonitorDto,
      userId,
    );
    return res;
  }

  @Patch(':id')
  async updateMonitor(
    @Param('id') id: string,
    @Body() updateMonitorDto: UpdateMonitorDto,
  ) {
    const res = await this.monitorService.updateMonitor(id, updateMonitorDto);
    return res;
  }

  @Delete(':id')
  async deleteMonitor(@Param('id') id: string) {
    const res = await this.monitorService.deleteMonitor(id);
    return res;
  }

  @Get(':id')
  async getMonitor(@Param('id') id: string) {
    const res = await this.monitorService.getMonitor(id);
    return res;
  }

  @Get('/user/:userId')
  async getAllMonitorsOfUser(@Param('userId') userId: string) {
    const res = await this.monitorService.getAllMonitorsOfUser(userId);
    return res;
  }

  @Get(':id/uptime')
  async getUptimeDataOfMonitor(
    @Param('id') monitorId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const res = await this.monitorService.getUptimeDataOfMonitor(
      monitorId,
      from,
      to,
    );
    return res;
  }

  @Get(':id/uptime/summary')
  async getUptimeSummaryOfMonitor(@Param('id') monitorId: string) {
    const res = await this.monitorService.getUptimeSummaryOfMonitor(monitorId);
    return res;
  }

  @Sse('sse/events')
  sse(@Req() req: any) {
    const userId = req.user.sub;
    return this.monitorStream.getStream(userId)?.pipe(map((data) => ({ data })))
  }
}
