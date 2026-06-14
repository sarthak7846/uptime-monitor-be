import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class IncidentService {
  private readonly logger = new Logger(IncidentService.name, {
    timestamp: true,
  });
  constructor(private readonly prisma: PrismaService) {}

  async getAllIncidents() {
    try {
      this.logger.log('Fetching all monitors', this.getAllIncidents.name);
      const res = await this.prisma.incident.findMany();
      return res;
    } catch (error) {
      this.logger.error('Failed to fetch all incidents', error);
      throw error;
    }
  }
}
