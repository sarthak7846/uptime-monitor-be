import { Controller, Get } from '@nestjs/common';
import { IncidentService } from './incident.service';

@Controller('incident')
export class IncidentController {
  constructor(private readonly incidentService: IncidentService) {}

  @Get('/all')
  async getAllIncidents() {
    const res = await this.incidentService.getAllIncidents();
    return res;
  }
}
