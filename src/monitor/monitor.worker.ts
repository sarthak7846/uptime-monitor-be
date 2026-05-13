import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import axios from 'axios';
import { Monitor } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from 'src/notification/notification.service';
import { ProbeResult } from './interfaces/probe-result.interface';
import { NotificationEventType } from 'src/shared/events/notification-event.types';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class MonitorWorker implements OnModuleInit, OnModuleDestroy {
  private worker: Worker;
  private readonly logger = new Logger(MonitorWorker.name, {
    timestamp: true,
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly redisService: RedisService
  ) {}

  async onModuleInit() {
    this.worker = new Worker(
      'monitor-check',
      async (job) => {
        await this.processJob(job);
      },
      {
        connection: { host: 'localhost', port: 6379 },
      },
    );
    this.logger.log('Monitor worker started running');
  }

  async onModuleDestroy() {
    await this.worker.close();
  }

  private normalizeProbeResult(
    error: any,
    response: any,
    startTime: number,
  ): ProbeResult {
    const responseMs = Date.now() - startTime;

    if (response) {
      const status = response.status;

      if (status >= 200 && status < 400) {
        return {
          isHealthy: true,
          responseMs,
          statusCode: status,
        };
      }

      return {
        isHealthy: false,
        responseMs,
        statusCode: status,
        reason: `HTTP_${status}`,
      };
    }

    if (error) {
      return {
        isHealthy: false,
        reason: error.code || 'NETWORK_ERROR',
      };
    }

    return {
      isHealthy: false,
      reason: 'UNKNOWN_ERROR',
    };
  }

  private async runProbe(monitor: Partial<Monitor>): Promise<ProbeResult> {
    const { timeout, url, method } = monitor;
    const start = Date.now();

    try {
      const response = await axios({
        url,
        method,
        timeout,
        validateStatus: () => true, // Dont throw on 4xx/5xx
      });

      return this.normalizeProbeResult(null, response, start);
    } catch (error) {
      return this.normalizeProbeResult(error, null, start);
    }
  }

  private async startIncident(monitorId: string, reason?: string) {
    console.log('Incident started', monitorId);

    return this.prisma.incident.create({
      data: {
        monitorId,
        startedAt: new Date(),
        status: 'OPEN',
        triggerReason: reason ?? 'HEALTH_CHECK_FAILED',
      },
    });
  }

  private async resolveIncident(monitorId: string) {
    console.log('Incident resolved', monitorId);

    // First, fetch the open incidents before resolving them
    const openIncidents = await this.prisma.incident.findMany({
      where: {
        monitorId,
        status: 'OPEN',
      },
    });

    // Then resolve them
    await this.prisma.incident.updateMany({
      where: {
        monitorId,
        status: 'OPEN',
      },
      data: {
        status: 'RESOLVED',
        endedAt: new Date(),
      },
    });

    // Return the resolved incidents
    return openIncidents;
  }

  private async processJob(job: any) {
    console.log('Running job', job.data);

    const { monitorId } = job.data;

    const monitor = await this.prisma.monitor.findFirst({
      where: { id: monitorId },
      select: {
        id: true,
        userId: true,
        name: true,
        lastStatus: true,
        consecutiveFailures: true,
        consecutiveSuccesses: true,
        timeout: true,
        url: true,
        method: true,
      },
    });

    if (!monitor) throw new NotFoundException('Monitor not found');

    const probeResult = await this.runProbe(monitor);

    const isHealthy = probeResult.isHealthy;

    const failureThreshold = 3;
    const successThreshold = 2;

    let nextStatus = monitor.lastStatus;
    let nextConsecutiveFailures = monitor.consecutiveFailures;
    let nextConsecutiveSuccesses = monitor.consecutiveSuccesses;
    let shouldStartIncident = false;
    let shouldResolveIncident = false;

    // console.log('probe result', probeResult);

    // Probe is healthy
    if (isHealthy) {
      nextConsecutiveFailures = 0;

      if (monitor.lastStatus === 'DOWN') {
        nextConsecutiveSuccesses++;

        if (nextConsecutiveSuccesses >= successThreshold) {
          nextStatus = 'UP';
          shouldResolveIncident = true;
          nextConsecutiveSuccesses = 0;
        }
      } else {
        nextConsecutiveSuccesses = 0;
      }

      if (monitor.lastStatus === 'PENDING') {
        nextStatus = 'UP';
      }
      //Probe failed
    } else {
      nextConsecutiveFailures++;
      nextConsecutiveSuccesses = 0;

      //Only transition after threshold
      if (nextConsecutiveFailures >= failureThreshold) {
        if (monitor.lastStatus === 'UP' || monitor.lastStatus === 'PENDING') {
          nextStatus = 'DOWN';
          shouldStartIncident = true;
        }
        nextConsecutiveFailures = failureThreshold;
      }
    }

    const statusChanged = monitor.lastStatus !== nextStatus;

    await Promise.all([
      this.prisma.monitor.update({
        where: { id: monitorId },
        data: {
          lastStatus: nextStatus,
          consecutiveFailures: nextConsecutiveFailures,
          consecutiveSuccesses: nextConsecutiveSuccesses,
        },
      }),
      this.prisma.monitorLog.create({
        data: {
          monitorId,
          status: isHealthy ? 'UP' : 'DOWN',
          responseMs: probeResult.responseMs,
          statusCode: probeResult.statusCode,
          reason: probeResult.reason,
        },
      }),
      
    ]);

    if(statusChanged) {
      await this.redisService.pub.publish(`monitor-updates:${monitor.userId}`, JSON.stringify({
        monitorId,
        status: nextStatus
      }))
    }

    //Incident start/resolve operation
    if (shouldStartIncident) {
      const incident = await this.startIncident(monitorId, probeResult.reason);

      await this.notificationService.emitNotification({
        id: incident.id,
        type: NotificationEventType.MONITOR_DOWN,
        userId: monitor.userId,
        monitorId: monitor.id,
        incidentId: incident.id,
        occurredAt: new Date(),
        data: {
          monitorName: monitor.name || monitor.url,
          url: monitor.url,
          currentStatus: 'DOWN',
          previousStatus: monitor.lastStatus as 'UP' | 'DOWN',
          responseTime: probeResult.responseMs,
          errorMessage: probeResult.reason,
        },
      });

      this.logger.log('Emitted start incident notification');
    }

    if (shouldResolveIncident) {
      const resolvedIncidents = await this.resolveIncident(monitorId);

      // Handle multiple resolved incidents (though typically there should be only one)
      for (const incident of resolvedIncidents) {
        await this.notificationService.emitNotification({
          id: incident.id,
          type: NotificationEventType.MONITOR_UP,
          userId: monitor.userId,
          monitorId: monitor.id,
          incidentId: incident.id,
          occurredAt: new Date(),
          data: {
            monitorName: monitor.name || monitor.url,
            url: monitor.url,
            currentStatus: 'UP',
            previousStatus: monitor.lastStatus as 'UP' | 'DOWN',
            responseTime: probeResult.responseMs,
          },
        });
      }

      this.logger.log(`Emitted resolve incident notification for ${resolvedIncidents.length} incident(s)`);
    }

    console.log(`${monitor.url} ${nextStatus} (${probeResult.responseMs}ms)`);
  }
}
