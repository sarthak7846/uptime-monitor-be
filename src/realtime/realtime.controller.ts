import { Controller, Req, Sse } from '@nestjs/common';
import { RealtimeStreamService } from './realtime-stream.service';
import { map } from 'rxjs';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtimeStreamService: RealtimeStreamService) {}

  @Sse('sse/events')
  sse(@Req() req: any) {
    const userId = req.user.sub;
    return this.realtimeStreamService.getStream(userId)?.pipe(map((data) => ({ data })));
  }
}
