import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import { filter, map, Observable, Subject } from 'rxjs';
import { OutboxEvent } from '../../outbox/domain/outbox-event.interface';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly eventStream$ = new Subject<OutboxEvent>();
  private readonly recentEvents: OutboxEvent[] = [];
  private readonly MAX_HISTORY = 50;

  /**
   * Publish an outbox event to connected realtime subscribers
   */
  publish(event: OutboxEvent): void {
    this.logger.log(`Realtime delivery: [${event.eventType}] for branch #${event.branchId}`);

    this.recentEvents.unshift(event);
    if (this.recentEvents.length > this.MAX_HISTORY) {
      this.recentEvents.pop();
    }

    this.eventStream$.next(event);
  }

  /**
   * Subscribe to events for a specific branch (for staff: waiters, kitchen, manager)
   */
  subscribeBranch(branchId: number): Observable<MessageEvent> {
    return this.eventStream$.asObservable().pipe(
      filter((e) => e.branchId === branchId),
      map((e) => ({
        type: e.eventType,
        data: {
          id: e.id,
          type: e.eventType,
          aggregate_type: e.aggregateType,
          aggregate_id: e.aggregateId,
          branch_id: e.branchId,
          payload: e.payload,
          timestamp: e.createdAt.toISOString(),
        },
      } as MessageEvent)),
    );
  }

  /**
   * Subscribe to events for a specific customer table session
   */
  subscribeSession(tableSessionId: number): Observable<MessageEvent> {
    return this.eventStream$.asObservable().pipe(
      filter(
        (e) =>
          Number(e.payload?.table_session_id || e.payload?.tableSessionId) ===
          tableSessionId,
      ),
      map((e) => ({
        type: e.eventType,
        data: {
          id: e.id,
          type: e.eventType,
          payload: e.payload,
          timestamp: e.createdAt.toISOString(),
        },
      } as MessageEvent)),
    );
  }

  /**
   * Get recent events for a branch
   */
  getRecentEvents(branchId: number): OutboxEvent[] {
    return this.recentEvents.filter((e) => e.branchId === branchId);
  }
}
