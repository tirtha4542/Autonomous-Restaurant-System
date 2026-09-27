import { Order } from './order.entity';

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export interface IOrderRepository {
  create(order: Order): Promise<Order>;
  findById(id: number, branchId: number): Promise<Order | null>;
  findByBranch(branchId: number, status?: string): Promise<Order[]>;
  updateStatus(id: number, status: string): Promise<Order>;
}
