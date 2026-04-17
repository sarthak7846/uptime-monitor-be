import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMonitorDto } from './create-monitor.dto';
import { UpdateMonitorDto } from './update-monitor.dto';
import { monitorQueue } from 'src/queue/queue.config';

@Injectable()
export class MonitorService {
  private readonly logger = new Logger(MonitorService.name, {
    timestamp: true,
  });

  constructor(private readonly prisma: PrismaService) { }

  async getAllMonitors() {
    const res = await this.prisma.monitor.findMany();
    return res;
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
    const monitor = await this.prisma.monitor.findFirst({
      where: { id },
    });

    if (monitor && monitor?.interval !== updateMonitorDto?.interval) {
      // Reschedule job
      const schedulers = await monitorQueue.getJobSchedulers();

      console.log('existing jobs', JSON.stringify(schedulers, null, 2));

      const scheduler = schedulers.find(
        (s) => s.template?.data.monitorId === monitor.id,
      );

      if (scheduler) {
        await monitorQueue.removeJobScheduler(scheduler.key);
      }

      // console.log('matching job', monitorJob);
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
    return res;
  }

  async deleteMonitor(id: string) {
    const res = await this.prisma.monitor.delete({ where: { id } });

    const schedulers = await monitorQueue.getJobSchedulers();

    const scheduler = schedulers.find((s) => s.template?.data.monitorId === id);

    if (scheduler) {
      await monitorQueue.removeJobScheduler(scheduler.key);
    }

    return res;
  }

  async getMonitor(id: string) {
    const res = await this.prisma.monitor.findUnique({ where: { id } });
    return res;
  }

  async getAllMonitorsOfUser(userId: string) {
    const res = await this.prisma.monitor.findMany({ where: { userId } });
    return res;
  }

  async getUptimeDataOfMonitor(monitorId: string, from: string, to: string) {
    const requestedStart = new Date(from);
    const requestedEnd = new Date(to);
    const now = new Date();

    if (requestedStart >= requestedEnd) {
      throw new Error('Invalid time window');
    }

    // 1️⃣ Fetch monitor (needed for createdAt clamp)
    const monitor = await this.prisma.monitor.findUnique({
      where: { id: monitorId },
      select: { createdAt: true },
    });

    if (!monitor) {
      throw new Error('Monitor not found');
    }

    const windowStart = new Date(
      Math.max(requestedStart.getTime(), monitor.createdAt.getTime()),
    );

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

    // 4️⃣ Calculate downtime using overlap clamping
    let totalDowntimeMs = 0;

    for (const incident of incidents) {
      const incidentStart = new Date(
        Math.max(incident.startedAt.getTime(), windowStart.getTime()),
      );

      const incidentEnd = new Date(
        Math.min((incident.endedAt ?? now).getTime(), windowEnd.getTime()),
      );

      console.log(
        `Incident ${incident.id} overlaps window: clamped start = ${incidentStart.toISOString()}, clamped end = ${incidentEnd.toISOString()}`,
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

    return {
      monitorId,
      from: windowStart.toISOString(),
      to: windowEnd.toISOString(),
      uptimePercentage: Number(uptimePercentage.toFixed(2)),
      totalWindowSizeMs,
      totalDowntimeMs,
      incidentCount: incidents.length,
    };
  }

  async getUptimeSummaryOfMonitor(monitorId: string) {
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
  }
}
