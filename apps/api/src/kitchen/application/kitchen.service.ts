import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IKitchenRepository,
  KITCHEN_REPOSITORY,
} from '../domain/kitchen.repository.interface';
import { KitchenItem } from '../domain/kitchen-item.entity';
import { OutboxService } from '../../outbox/application/outbox.service';

@Injectable()
export class KitchenService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(KITCHEN_REPOSITORY)
    private readonly repo: IKitchenRepository,
    private readonly outboxService: OutboxService,
  ) {}

  async getQueue(branchId: number, station?: string): Promise<KitchenItem[]> {
    return this.repo.findQueueByBranch(branchId, station);
  }

  async startItem(itemId: number, branchId: number): Promise<KitchenItem> {
    const item = await this.repo.findById(itemId, branchId);
    if (!item) {
      throw new NotFoundException(`Kitchen item #${itemId} not found in branch #${branchId}`);
    }

    if (item.status === 'ready') {
      throw new BadRequestException(`Kitchen item #${itemId} is already ready`);
    }

    const updated = await this.repo.updateItemStatus(itemId, 'preparing');

    // Update parent order to PREPARING if currently ACCEPTED
    await this.prisma.orders.updateMany({
      where: {
        id: item.orderId,
        status: 'ACCEPTED',
      },
      data: { status: 'PREPARING' },
    });

    return updated;
  }

  async readyItem(itemId: number, branchId: number): Promise<{ item: KitchenItem; orderReady: boolean }> {
    const item = await this.repo.findById(itemId, branchId);
    if (!item) {
      throw new NotFoundException(`Kitchen item #${itemId} not found in branch #${branchId}`);
    }

    const updated = await this.repo.updateItemStatus(itemId, 'ready');

    // Check if all items in this order are now ready
    const allReady = await this.repo.checkAllOrderItemsReady(item.orderId);
    if (allReady) {
      await this.prisma.orders.update({
        where: { id: item.orderId },
        data: { status: 'READY' },
      });
    }

    // Emit OrderItemReady via Outbox
    await this.outboxService.emitOrderItemReady({
      itemId: updated.id,
      orderId: updated.orderId,
      name: updated.name,
      station: updated.station,
      tableCode: updated.tableCode,
      branchId,
      orderReady: allReady,
    });

    return {
      item: updated,
      orderReady: allReady,
    };
  }
}
