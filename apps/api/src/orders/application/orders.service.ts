import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IOrderRepository,
  ORDER_REPOSITORY,
} from '../domain/order.repository.interface';
import { Order, OrderItemProps } from '../domain/order.entity';
import { OrderStatus } from '../domain/order-status.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { ActorContext } from '../../auth/domain/actor-context.interface';
import { OutboxService } from '../../outbox/application/outbox.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepo: IOrderRepository,
    private readonly outboxService: OutboxService,
  ) {}

  async submitOrder(dto: CreateOrderDto, actor: ActorContext): Promise<Order> {
    const branchId = Number(actor.branch_id);
    const tableSessionId =
      dto.table_session_id ||
      (actor.resource_scope?.table_session_id
        ? Number(actor.resource_scope.table_session_id)
        : null);

    if (!tableSessionId) {
      throw new BadRequestException('table_session_id is required');
    }

    const session = await this.prisma.table_sessions.findFirst({
      where: { id: tableSessionId, branch_id: branchId, closed_at: null },
    });

    if (!session) {
      throw new NotFoundException(`Active table session #${tableSessionId} not found in branch #${branchId}`);
    }

    const menuItemIds = dto.items.map((i) => i.menu_item_id);
    const menuItems = await this.prisma.menu_items.findMany({
      where: {
        id: { in: menuItemIds },
        branch_id: branchId,
      },
    });

    if (menuItems.length !== menuItemIds.length) {
      throw new BadRequestException('One or more menu items are invalid or not available in this branch');
    }

    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    const items: OrderItemProps[] = dto.items.map((i) => {
      const mi = menuItemMap.get(i.menu_item_id)!;
      return {
        menuItemId: mi.id,
        name: mi.name,
        price: Number(mi.price),
        quantity: i.quantity,
        station: mi.station,
        modifiers: i.modifiers || {},
        status: 'pending',
      };
    });

    const guestSessionId = actor.resource_scope?.guest_session_id
      ? Number(actor.resource_scope.guest_session_id)
      : null;

    const domainOrder = new Order({
      tableSessionId,
      guestSessionId,
      isShared: true,
      status: OrderStatus.SUBMITTED,
      items,
    });

    const createdOrder = await this.orderRepo.create(domainOrder);

    // Emit OrderSubmitted via Outbox
    await this.outboxService.emitOrderSubmitted({
      orderId: createdOrder.id!,
      tableSessionId: createdOrder.tableSessionId,
      tableCode: createdOrder.tableCode,
      branchId,
      items: items.map((i) => ({
        name: i.name || 'Item',
        quantity: i.quantity,
        station: i.station,
      })),
    });

    return createdOrder;
  }

  async getOrders(branchId: number, status?: string): Promise<Order[]> {
    return this.orderRepo.findByBranch(branchId, status);
  }

  async getOrderById(id: number, branchId: number): Promise<Order> {
    const order = await this.orderRepo.findById(id, branchId);
    if (!order) {
      throw new NotFoundException(`Order #${id} not found in branch #${branchId}`);
    }
    return order;
  }

  async acceptOrder(id: number, branchId: number): Promise<Order> {
    const order = await this.getOrderById(id, branchId);

    try {
      order.accept();
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    const updated = await this.orderRepo.updateStatus(id, order.status);

    // Emit OrderAccepted via Outbox
    await this.outboxService.emitOrderAccepted({
      orderId: updated.id!,
      tableSessionId: updated.tableSessionId,
      tableCode: updated.tableCode,
      branchId,
    });

    return updated;
  }

  async rejectOrder(id: number, branchId: number): Promise<Order> {
    const order = await this.getOrderById(id, branchId);

    try {
      order.reject();
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    return this.orderRepo.updateStatus(id, order.status);
  }

  async serveOrder(id: number, branchId: number): Promise<Order> {
    const order = await this.getOrderById(id, branchId);

    try {
      order.serve();
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    return this.orderRepo.updateStatus(id, order.status);
  }
}
