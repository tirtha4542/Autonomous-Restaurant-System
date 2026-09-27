import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IOrderRepository } from '../domain/order.repository.interface';
import { Order, OrderItemProps } from '../domain/order.entity';
import { OrderStatus } from '../domain/order-status.enum';

@Injectable()
export class PrismaOrdersRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(order: Order): Promise<Order> {
    const created = await this.prisma.orders.create({
      data: {
        table_session_id: order.tableSessionId,
        guest_session_id: order.guestSessionId || null,
        is_shared: order.isShared,
        status: order.status,
        order_items: {
          create: order.items.map((item) => ({
            menu_item_id: item.menuItemId,
            quantity: item.quantity,
            modifiers: item.modifiers || {},
            status: item.status || 'pending',
            station: item.station || 'kitchen',
          })),
        },
      },
      include: {
        order_items: {
          include: {
            menu_items: true,
          },
        },
        table_sessions: {
          include: {
            dining_tables: true,
          },
        },
      },
    });

    return this.mapToDomain(created);
  }

  async findById(id: number, branchId: number): Promise<Order | null> {
    const record = await this.prisma.orders.findFirst({
      where: {
        id,
        table_sessions: {
          branch_id: branchId,
        },
      },
      include: {
        order_items: {
          include: {
            menu_items: true,
          },
        },
        table_sessions: {
          include: {
            dining_tables: true,
          },
        },
      },
    });

    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findByBranch(branchId: number, status?: string): Promise<Order[]> {
    const records = await this.prisma.orders.findMany({
      where: {
        table_sessions: {
          branch_id: branchId,
        },
        ...(status ? { status } : {}),
      },
      include: {
        order_items: {
          include: {
            menu_items: true,
          },
        },
        table_sessions: {
          include: {
            dining_tables: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    });

    return records.map((r) => this.mapToDomain(r));
  }

  async updateStatus(id: number, status: string): Promise<Order> {
    const updated = await this.prisma.orders.update({
      where: { id },
      data: { status },
      include: {
        order_items: {
          include: {
            menu_items: true,
          },
        },
        table_sessions: {
          include: {
            dining_tables: true,
          },
        },
      },
    });

    return this.mapToDomain(updated);
  }

  private mapToDomain(record: any): Order {
    const items: OrderItemProps[] = (record.order_items || []).map((oi: any) => ({
      id: oi.id,
      menuItemId: oi.menu_item_id,
      name: oi.menu_items?.name,
      price: oi.menu_items?.price ? Number(oi.menu_items.price) : undefined,
      quantity: oi.quantity,
      station: oi.station,
      modifiers: oi.modifiers,
      status: oi.status,
    }));

    return new Order({
      id: record.id,
      tableSessionId: record.table_session_id,
      guestSessionId: record.guest_session_id,
      isShared: record.is_shared,
      status: record.status as OrderStatus,
      items,
      tableCode: record.table_sessions?.dining_tables?.code,
    });
  }
}
