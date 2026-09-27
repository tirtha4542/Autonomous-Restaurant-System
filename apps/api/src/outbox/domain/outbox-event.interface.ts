export type OutboxEventType =
  | 'OrderSubmitted'
  | 'OrderAccepted'
  | 'OrderRejected'
  | 'OrderItemReady'
  | 'OrderReady'
  | 'OrderServed'
  | 'PaymentSettled'
  | 'SessionClosed';

export interface OutboxEvent<T = Record<string, any>> {
  id: string;
  eventType: OutboxEventType;
  aggregateType: string;
  aggregateId: string;
  branchId: number;
  payload: T;
  createdAt: Date;
  publishedAt?: Date | null;
}
