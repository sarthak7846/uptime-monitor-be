import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMonitorDto } from './create-monitor.dto';
import { UpdateMonitorDto } from './update-monitor.dto';
import { monitorQueue } from 'src/queue/queue.config';
import { Incident } from '@prisma/client';

@Injectable()
export class MonitorService {
  private readonly logger = new Logger(MonitorService.name, {
    timestamp: true,
  });

  constructor(private readonly prisma: PrismaService) {}

  async getAllMonitors() {
    try {
      this.logger.log('Fetching all monitors', this.getAllMonitors.name);
      const res = await this.prisma.monitor.findMany();
      return res;
    } catch (error) {
      this.logger.error('Failed to fetch all monitors', error);
      throw error;
    }
  }

  async createMonitor(createMonitorDto: CreateMonitorDto, userId: string) {
    try {
      const res = await this.prisma.monitor.create({
        data: { ...createMonitorDto, userId },
      });

      // Enqueue first check
      await monitorQueue.add(
        'check-monitor',
        {
          monitorId: res.id,
        },
        {
          jobId: `monitor:${res.id}`,
          repeat: {
            every: createMonitorDto.interval,
          },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );

      this.logger.log('Monitor created successfully', this.createMonitor.name);

      return res;
    } catch (error) {
      this.logger.error('Failed to create monitor', error);
      throw error;
    }
  }

  async updateMonitor(id: string, updateMonitorDto: UpdateMonitorDto) {
    try {
      this.logger.log(`Updating monitor: ${id}`, this.updateMonitor.name);
      const monitor = await this.prisma.monitor.findFirst({
        where: { id },
      });

      if (monitor && monitor?.interval !== updateMonitorDto?.interval) {
        // Reschedule job
        const schedulers = await monitorQueue.getJobSchedulers();

        console.log('existing jobs', JSON.stringify(schedulers, null, 2));

        const scheduler = schedulers.find((s) => s.template?.data.monitorId === monitor.id);

        if (scheduler) {
          await monitorQueue.removeJobScheduler(scheduler.key);
        }

        await monitorQueue.add(
          'check-monitor',
          {
            monitorId: monitor.id,
          },
          {
            repeat: {
              every: updateMonitorDto.interval,
            },
            removeOnComplete: true,
            removeOnFail: 100,
          },
        );
      }

      const res = await this.prisma.monitor.update({
        where: { id },
        data: updateMonitorDto,
      });

      this.logger.log(`Monitor updated successfully: ${id}`, this.updateMonitor.name);

      return res;
    } catch (error) {
      this.logger.error(`Failed to update monitor: ${id}`, error);
      throw error;
    }
  }

  async deleteMonitor(id: string) {
    try {
      this.logger.log(`Deleting monitor: ${id}`, this.deleteMonitor.name);

      const existingMonitor = await this.prisma.monitor.findUnique({
        where: { id },
      });

      if (!existingMonitor) {
        this.logger.warn(`Delete failed, monitor not found: ${id}`, this.deleteMonitor.name);
        throw new NotFoundException('Monitor not found');
      }

      const res = await this.prisma.monitor.delete({ where: { id } });

      const schedulers = await monitorQueue.getJobSchedulers();

      const scheduler = schedulers.find((s) => s.template?.data.monitorId === id);

      if (scheduler) {
        await monitorQueue.removeJobScheduler(scheduler.key);
        this.logger.log(`Removed scheduler for monitor: ${id}`, this.deleteMonitor.name);
      }

      this.logger.log(`Monitor deleted successfully: ${id}`, this.deleteMonitor.name);

      return res;
    } catch (error) {
      this.logger.error(`Failed to delete monitor: ${id}`, error);
      throw error;
    }
  }

  async getMonitor(id: string) {
    try {
      this.logger.log(`Fetching monitor: ${id}`, this.getMonitor.name);
      const res = await this.prisma.monitor.findUnique({ where: { id } });
      return res;
    } catch (error) {
      this.logger.error(`Failed to fetch monitor: ${id}`, error);
      throw error;
    }
  }

  async getAllMonitorsOfUser(userId: string) {
    try {
      this.logger.log(`Fetching all monitors for user: ${userId}`, this.getAllMonitorsOfUser.name);
      const res = await this.prisma.monitor.findMany({ where: { userId } });
      return res;
    } catch (error) {
      this.logger.error(`Failed to fetch monitors for user: ${userId}`, error);
      throw error;
    }
  }

  async getUptimeDataOfMonitor(
    monitorId: string,
    from: string,
    to: string,
    monitorCreatedAt?: Date,
  ) {
    try {
      this.logger.log(
        `Calculating uptime data for monitor: ${monitorId}`,
        this.getUptimeDataOfMonitor.name,
      );

      const requestedStart = new Date(from);
      const requestedEnd = new Date(to);
      const now = new Date();

      if (requestedStart >= requestedEnd) {
        this.logger.warn(
          `Invalid uptime time window for monitor: ${monitorId}`,
          this.getUptimeDataOfMonitor.name,
        );
        throw new BadRequestException('Invalid time window');
      }

      if (!monitorCreatedAt) {
        // 1️⃣ Fetch monitor (needed for createdAt clamp)
        const monitor = await this.prisma.monitor.findUnique({
          where: { id: monitorId },
          select: { createdAt: true },
        });

        if (!monitor) {
          this.logger.warn(
            `Uptime data fetch failed, monitor not found: ${monitorId}`,
            this.getUptimeDataOfMonitor.name,
          );
          throw new NotFoundException('Monitor not found');
        }

        monitorCreatedAt = monitor.createdAt;
      }

      const windowStart = new Date(Math.max(requestedStart.getTime(), monitorCreatedAt.getTime()));

      const windowEnd = new Date(Math.min(requestedEnd.getTime(), now.getTime()));

      if (windowStart >= windowEnd) {
        return {
          monitorId,
          from,
          to,
          uptimePercentage: 100,
          totalWindowSizeMs: 0,
          totalDowntimeMs: 0,
          incidentCount: 0,
        };
      }

      // 3️⃣ Fetch ALL incidents that overlap the window
      const incidents = await this.prisma.incident.findMany({
        where: {
          monitorId,
          startedAt: {
            lte: windowEnd, // incident started before window ends
          },
          OR: [
            {
              endedAt: {
                gte: windowStart, // incident ended after window starts
              },
            },
            {
              endedAt: null, // still open
            },
          ],
        },
        orderBy: {
          startedAt: 'asc',
        },
      });

      const result = this.calculateUptimePercentage(from, to, monitorCreatedAt, incidents);

      this.logger.log(
        `Uptime data calculated successfully for monitor: ${monitorId}`,
        this.getUptimeDataOfMonitor.name,
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to calculate uptime data for monitor: ${monitorId}`, error);
      throw error;
    }
  }

  calculateUptimePercentage(
    from: string,
    to: string,
    monitorCreatedAt: Date,
    incidents: Incident[],
  ) {
    const requestedStart = new Date(from);
    const requestedEnd = new Date(to);
    const now = new Date();

    if (requestedStart >= requestedEnd) {
      this.logger.warn(`Invalid uptime time window`, this.calculateUptimePercentage.name);
      throw new BadRequestException('Invalid time window');
    }
    const windowStart = new Date(Math.max(requestedStart.getTime(), monitorCreatedAt.getTime()));

    const windowEnd = new Date(Math.min(requestedEnd.getTime(), now.getTime()));

    if (windowStart >= windowEnd) {
      return {
        from,
        to,
        uptimePercentage: 100,
        totalWindowSizeMs: 0,
        totalDowntimeMs: 0,
        incidentCount: 0,
      };
    }
    // 4️⃣ Calculate downtime using overlap clamping
    let totalDowntimeMs = 0;

    for (const incident of incidents) {
      const incidentStart = new Date(Math.max(incident.startedAt.getTime(), windowStart.getTime()));

      const incidentEnd = new Date(
        Math.min((incident.endedAt ?? now).getTime(), windowEnd.getTime()),
      );

      this.logger.debug(
        `Incident ${incident.id} overlap: ${incidentStart.toISOString()} - ${incidentEnd.toISOString()}`,
        this.getUptimeDataOfMonitor.name,
      );

      if (incidentEnd > incidentStart) {
        totalDowntimeMs += incidentEnd.getTime() - incidentStart.getTime();
      }
    }
    // 5️⃣ Calculate uptime
    const totalWindowSizeMs = windowEnd.getTime() - windowStart.getTime();

    const uptimePercentage =
      totalWindowSizeMs === 0
        ? 100
        : ((totalWindowSizeMs - totalDowntimeMs) / totalWindowSizeMs) * 100;

    const result = {
      from: windowStart.toISOString(),
      to: windowEnd.toISOString(),
      uptimePercentage: Number(uptimePercentage.toFixed(2)),
      // totalWindowSizeMs,
      // totalDowntimeMs,
      incidentCount: incidents.length,
    };

    this.logger.log(`Uptime data calculated successfully`, this.calculateUptimePercentage.name);

    return result;
  }

  async getUptimeSummaryOfMonitor(monitorId: string) {
    try {
      this.logger.log(
        `Calculating uptime summary for monitor: ${monitorId}`,
        this.getUptimeSummaryOfMonitor.name,
      );
      const now = new Date();
      const _24hrs = 24 * 60 * 60 * 1000;
      const before24hrs = now.getTime() - _24hrs;
      const before7days = now.getTime() - 7 * _24hrs;
      const before30days = now.getTime() - 30 * _24hrs;

      const [last24hrs, last7days, last30days] = await Promise.all([
        this.getUptimeDataOfMonitor(
          monitorId,
          new Date(before24hrs).toISOString(),
          now.toISOString(),
        ),
        this.getUptimeDataOfMonitor(
          monitorId,
          new Date(before7days).toISOString(),
          now.toISOString(),
        ),
        this.getUptimeDataOfMonitor(
          monitorId,
          new Date(before30days).toISOString(),
          now.toISOString(),
        ),
      ]);

      return {
        monitorId,
        last24hrs: { uptime: last24hrs.uptimePercentage },
        last7days: { uptime: last7days.uptimePercentage },
        last30days: { uptime: last30days.uptimePercentage },
      };
    } catch (error) {
      this.logger.error(`Failed to calculate uptime summary for monitor: ${monitorId}`, error);
      throw error;
    }
  }
}
