import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class IncidentService {
  private readonly logger = new Logger(IncidentService.name, {
    timestamp: true,
  });
  constructor(private readonly prisma: PrismaService) {}

  async getAllIncidents(userId: string) {
    try {
      this.logger.log('Fetching all incidents', this.getAllIncidents.name);
      const res = await this.prisma.incident.findMany({
        where: {
          userId,
        },
        include: {
          monitor: {
            select: {
              name: true,
            },
          },
        },
      });

      return res.map((inc) => ({
        ...inc,
        monitorName: inc.monitor.name,
      }));
    } catch (error) {
      this.logger.error('Failed to fetch all incidents', error);
      throw error;
    }
  }
}
