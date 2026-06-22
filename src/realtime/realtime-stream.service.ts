import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';

@Injectable()
export class RealtimeStreamService {
  private readonly logger = new Logger(RealtimeStreamService.name, {
    timestamp: true,
  });
  private subjects = new Map<string, Subject<unknown>>();

  getStream(userId: string) {
    if (!this.subjects.has(userId)) this.subjects.set(userId, new Subject());
    return this.subjects.get(userId)?.asObservable();
  }

  emit(event: unknown, userId: string) {
    this.logger.log(`Emitting sse event: ${JSON.stringify(event)}`);
    const subject = this.subjects.get(userId);
    if (subject) subject.next(event);
  }

  remove(userId: string) {
    this.subjects.get(userId)?.complete();
    this.subjects.delete(userId);
  }
}
