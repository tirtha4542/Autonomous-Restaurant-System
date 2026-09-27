import { KitchenItem } from './kitchen-item.entity';

export const KITCHEN_REPOSITORY = Symbol('KITCHEN_REPOSITORY');

export interface IKitchenRepository {
  findQueueByBranch(branchId: number, station?: string): Promise<KitchenItem[]>;
  findById(id: number, branchId: number): Promise<KitchenItem | null>;
  updateItemStatus(id: number, status: string): Promise<KitchenItem>;
  checkAllOrderItemsReady(orderId: number): Promise<boolean>;
}
