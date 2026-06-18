import { Module } from '@nestjs/common';
import { StatusPageController } from './status-page.controller';
import { StatusPageService } from './status-page.service';
import { MonitorModule } from 'src/monitor/monitor.module';

@Module({
  imports: [MonitorModule],
  controllers: [StatusPageController],
  providers: [StatusPageService],
})
export class StatusPageModule {}
