import { Controller, Get, Req } from '@nestjs/common';
import { IncidentService } from './incident.service';
import type { AuthenticatedRequest } from 'src/types/express';

@Controller('incident')
export class IncidentController {
  constructor(private readonly incidentService: IncidentService) {}

  @Get('/all')
  async getAllIncidents(@Req() request: AuthenticatedRequest) {
    const userId = request.user.sub;
    const res = await this.incidentService.getAllIncidents(userId);
    return res;
  }
}
