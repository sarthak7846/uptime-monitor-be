import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateStatusPageDto, UpdateStatusPageDto } from './status-page.dto';
import { Incident, Monitor, MonitorState } from '@prisma/client';
import { StatusPageStatus } from './status-page.enum';
import { MonitorService } from 'src/monitor/monitor.service';

@Injectable()
export class StatusPageService {
  private readonly logger = new Logger(StatusPageService.name, {
    timestamp: true,
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly monitorService: MonitorService,
  ) {}

  async createStatusPage(createDto: CreateStatusPageDto, userId: string) {
    const { monitorIds, ...rest } = createDto;

    return this.prisma.statusPage.create({
      data: {
        ...rest,
        userId,
        monitors: monitorIds?.length ? { connect: monitorIds.map((id) => ({ id })) } : undefined,
      },
      include: { monitors: true },
    });
  }

  async getStatusPages(userId: string) {
    const statusPages = await this.prisma.statusPage.findMany({
      where: { userId },
      include: { monitors: true },
    });

    return statusPages;
  }

  async getStatusPageById(id: string, userId: string) {
    const statusPage = await this.prisma.statusPage.findFirst({
      where: { id, userId },
      include: { monitors: true },
    });

    if (!statusPage) {
      throw new NotFoundException(`Status page with id ${id} not found`);
    }

    return statusPage;
  }

  async getStatusPageBySlug(slug: string) {
    const statusPage = await this.prisma.statusPage.findUnique({
      where: { slug },
      include: {
        monitors: {
          include: {
            incidents: true,
          },
        },
      },
    });

    if (!statusPage) {
      throw new NotFoundException(`Status page with slug "${slug}" not found`);
    }
    const monitors = statusPage.monitors;

    const downCount = monitors.filter((monitor) => monitor.lastStatus === MonitorState.DOWN).length;

    let overallStatus: StatusPageStatus;

    if (downCount === 0) {
      overallStatus = StatusPageStatus.OPERATIONAL;
    } else if (downCount === monitors.length) {
      overallStatus = StatusPageStatus.MAJOR_OUTAGE;
    } else {
      overallStatus = StatusPageStatus.PARTIAL_OUTAGE;
    }

    // Calculate 90 days uptime percentage
    const enrichedMonitors = monitors.map((monitor) => {
      const history = this.build90DayHistory(monitor);
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const uptime90Days = this.monitorService.calculateUptimePercentage(
        ninetyDaysAgo,
        new Date().toISOString(),
        monitor.createdAt,
        monitor.incidents,
      );

      return {
        id: monitor.id,
        name: monitor.name,
        status: monitor.lastStatus,
        uptime90Days,
        history,
      };
    });

    return { ...statusPage, overallStatus, monitors: enrichedMonitors };
  }

  async updateStatusPage(id: string, updateDto: UpdateStatusPageDto, userId: string) {
    try {
      const { monitorIds, ...rest } = updateDto;

      const res = await this.prisma.statusPage.update({
        where: { id, userId },
        data: {
          ...rest,
          monitors:
            monitorIds !== undefined
              ? { set: monitorIds.map((monitorId) => ({ id: monitorId })) }
              : undefined,
        },
        include: { monitors: true },
      });

      if (updateDto.monitorIds) {
        await this.prisma.monitor.updateMany({
          where: {
            id: {
              in: updateDto.monitorIds,
            },
            userId,
          },
          data: {
            statusPageId: id,
          },
        });
      } else {
        await this.prisma.monitor.updateMany({
          where: {
            statusPageId: id,
          },
          data: {
            statusPageId: null,
          },
        });
      }

      this.logger.log(`Status page updated successfully: ${id}`);

      return res;
    } catch (error) {
      this.logger.error(`Failed to update status page: ${id}`, error);
      throw error;
    }
  }

  async deleteStatusPage(id: string, userId: string) {
    try {
      const res = await this.prisma.statusPage.delete({
        where: { id, userId },
      });

      this.logger.log(`Status page deleted successfully: ${id}`);

      return res;
    } catch (error) {
      this.logger.error(`Failed to delete status page: ${id}`, error);
      throw error;
    }
  }

  build90DayHistory(monitor: Monitor & { incidents: Incident[] }) {
    const history: {
      date: string;
      uptime: number;
    }[] = [];

    const today = new Date();

    for (let i = 89; i >= 0; i--) {
      const dayStart = new Date(today);
      dayStart.setUTCHours(0, 0, 0, 0);
      dayStart.setUTCDate(dayStart.getUTCDate() - i);

      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

      const uptime = this.monitorService.calculateUptimePercentage(
        dayStart.toISOString(),
        dayEnd.toISOString(),
        monitor.createdAt,
        monitor.incidents,
      );

      history.push({
        date: dayStart.toISOString().split('T')[0],
        uptime: uptime.uptimePercentage,
      });
    }

    return history;
  }
}
