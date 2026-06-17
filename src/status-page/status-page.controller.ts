import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { StatusPageService } from './status-page.service';
import { CreateStatusPageDto, UpdateStatusPageDto } from './status-page.dto';
import type { AuthenticatedRequest } from 'src/types/express';
import { Public } from 'src/auth/public.decorator';

@Controller('status-pages')
export class StatusPageController {
  constructor(private readonly statusPageService: StatusPageService) {}

  @Post()
  async createStatusPage(
    @Body() createDto: CreateStatusPageDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = request.user.sub;
    const res = await this.statusPageService.createStatusPage(createDto, userId);
    return res;
  }

  @Get()
  async getStatusPages(@Req() request: AuthenticatedRequest) {
    const userId = request.user.sub;
    const res = await this.statusPageService.getStatusPages(userId);
    return res;
  }

  @Public()
  @Get(':slug')
  async getStatusPageBySlug(@Param('slug') slug: string) {
    const res = await this.statusPageService.getStatusPageBySlug(slug);
    return res;
  }

  @Get(':id')
  async getStatusPageById(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const userId = request.user.sub;
    const res = await this.statusPageService.getStatusPageById(id, userId);
    return res;
  }

  @Patch(':id')
  async updateStatusPage(
    @Param('id') id: string,
    @Body() updateDto: UpdateStatusPageDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = request.user.sub;
    const res = await this.statusPageService.updateStatusPage(id, updateDto, userId);
    return res;
  }

  @Delete(':id')
  async deleteStatusPage(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const userId = request.user.sub;
    const res = await this.statusPageService.deleteStatusPage(id, userId);
    return res;
  }
}
