import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IKitchenRepository } from '../domain/kitchen.repository.interface';
import { KitchenItem } from '../domain/kitchen-item.entity';

@Injectable()
export class PrismaKitchenRepository implements IKitchenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findQueueByBranch(branchId: number, station?: string): Promise<KitchenItem[]> {
    const items = await this.prisma.order_items.findMany({
      where: {
        orders: {
          table_sessions: {
            branch_id: branchId,
          },
          status: {
            in: ['ACCEPTED', 'PREPARING'],
          },
        },
        status: {
          in: ['pending', 'preparing'],
        },
        ...(station ? { station } : {}),
      },
      include: {
        menu_items: true,
        orders: {
          include: {
            table_sessions: {
              include: {
                dining_tables: true,
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    return items.map(
      (item) =>
        new KitchenItem({
          id: item.id,
          orderId: item.order_id,
          menuItemId: item.menu_item_id,
          name: item.menu_items.name,
          quantity: item.quantity,
          station: item.station,
          status: item.status,
          tableCode: item.orders.table_sessions?.dining_tables?.code,
        }),
    );
  }

  async findById(id: number, branchId: number): Promise<KitchenItem | null> {
    const item = await this.prisma.order_items.findFirst({
      where: {
        id,
        orders: {
          table_sessions: {
            branch_id: branchId,
          },
        },
      },
      include: {
        menu_items: true,
        orders: {
          include: {
            table_sessions: {
              include: {
                dining_tables: true,
              },
            },
          },
        },
      },
    });

    if (!item) return null;

    return new KitchenItem({
      id: item.id,
      orderId: item.order_id,
      menuItemId: item.menu_item_id,
      name: item.menu_items.name,
      quantity: item.quantity,
      station: item.station,
      status: item.status,
      tableCode: item.orders.table_sessions?.dining_tables?.code,
    });
  }

  async updateItemStatus(id: number, status: string): Promise<KitchenItem> {
    const updated = await this.prisma.order_items.update({
      where: { id },
      data: { status },
      include: {
        menu_items: true,
        orders: {
          include: {
            table_sessions: {
              include: {
                dining_tables: true,
              },
            },
          },
        },
      },
    });

    return new KitchenItem({
      id: updated.id,
      orderId: updated.order_id,
      menuItemId: updated.menu_item_id,
      name: updated.menu_items.name,
      quantity: updated.quantity,
      station: updated.station,
      status: updated.status,
      tableCode: updated.orders.table_sessions?.dining_tables?.code,
    });
  }

  async checkAllOrderItemsReady(orderId: number): Promise<boolean> {
    const remaining = await this.prisma.order_items.count({
      where: {
        order_id: orderId,
        status: { not: 'ready' },
      },
    });

    return remaining === 0;
  }
}
