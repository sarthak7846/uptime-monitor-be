import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateStatusPageDto, UpdateStatusPageDto } from './status-page.dto';
import { MonitorState } from '@prisma/client';
import { StatusPageStatus } from './status-page.enum';

@Injectable()
export class StatusPageService {
  private readonly logger = new Logger(StatusPageService.name, {
    timestamp: true,
  });

  constructor(private readonly prisma: PrismaService) {}

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
      include: { monitors: true },
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

    return { ...statusPage, overallStatus };
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
            statusPageId: id,
          },
          data: {
            statusPageId: null,
          },
        });
      } else {
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
}
