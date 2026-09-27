import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../../realtime/application/realtime.service';
import { OutboxEvent, OutboxEventType } from '../domain/outbox-event.interface';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  /**
   * Persist outbox event and dispatch to realtime publisher
   */
  async recordAndDispatch<T extends Record<string, any>>(params: {
    eventType: OutboxEventType;
    aggregateType: string;
    aggregateId: string;
    branchId: number;
    payload: T;
  }): Promise<OutboxEvent<T>> {
    const id = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();

    const outboxEvent: OutboxEvent<T> = {
      id,
      eventType: params.eventType,
      aggregateType: params.aggregateType,
      aggregateId: params.aggregateId,
      branchId: params.branchId,
      payload: params.payload,
      createdAt: now,
      publishedAt: null,
    };

    // 1. Persist Outbox record to audit_logs in PostgreSQL
    try {
      await this.prisma.audit_logs.create({
        data: {
          branch_id: params.branchId,
          actor_role: 'SYSTEM',
          event_type: `outbox.${params.eventType}`,
          payload: {
            outbox_id: id,
            aggregate_type: params.aggregateType,
            aggregate_id: params.aggregateId,
            event_type: params.eventType,
            payload: params.payload,
          },
          created_at: now,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to persist outbox record: ${(err as Error).message}`, (err as Error).stack);
    }

    // 2. Dispatch to realtime delivery (Realtime is delivery only, not source of truth)
    outboxEvent.publishedAt = new Date();
    this.realtimeService.publish(outboxEvent);

    return outboxEvent;
  }

  /**
   * Emit OrderSubmitted event
   */
  async emitOrderSubmitted(params: {
    orderId: number;
    tableSessionId: number;
    tableCode?: string;
    items: Array<{ name: string; quantity: number; station: string }>;
    branchId: number;
  }) {
    return this.recordAndDispatch({
      eventType: 'OrderSubmitted',
      aggregateType: 'Order',
      aggregateId: String(params.orderId),
      branchId: params.branchId,
      payload: {
        order_id: params.orderId,
        table_session_id: params.tableSessionId,
        table_code: params.tableCode,
        status: 'SUBMITTED',
        items: params.items,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Emit OrderAccepted event
   */
  async emitOrderAccepted(params: {
    orderId: number;
    tableSessionId: number;
    tableCode?: string;
    branchId: number;
  }) {
    return this.recordAndDispatch({
      eventType: 'OrderAccepted',
      aggregateType: 'Order',
      aggregateId: String(params.orderId),
      branchId: params.branchId,
      payload: {
        order_id: params.orderId,
        table_session_id: params.tableSessionId,
        table_code: params.tableCode,
        status: 'ACCEPTED',
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Emit OrderItemReady event
   */
  async emitOrderItemReady(params: {
    itemId: number;
    orderId: number;
    name: string;
    station: string;
    tableCode?: string;
    branchId: number;
    orderReady: boolean;
  }) {
    return this.recordAndDispatch({
      eventType: 'OrderItemReady',
      aggregateType: 'OrderItem',
      aggregateId: String(params.itemId),
      branchId: params.branchId,
      payload: {
        item_id: params.itemId,
        order_id: params.orderId,
        item_name: params.name,
        station: params.station,
        table_code: params.tableCode,
        order_ready: params.orderReady,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
