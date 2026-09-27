import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { KitchenService } from '../application/kitchen.service';
import { Actor } from '../../auth/infrastructure/decorators/actor.decorator';
import { RequirePermissions } from '../../auth/infrastructure/decorators/permissions.decorator';
import { ActorContext } from '../../auth/domain/actor-context.interface';

@Controller('kitchen')
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('queue')
  @RequirePermissions('orders.read')
  async getQueue(
    @Query('station') station: string | undefined,
    @Actor() actor: ActorContext,
  ) {
    const branchId = Number(actor.branch_id);
    return this.kitchenService.getQueue(branchId, station);
  }

  @Post('items/:id/start')
  @RequirePermissions('items.write')
  async startItem(
    @Param('id', ParseIntPipe) id: number,
    @Actor() actor: ActorContext,
  ) {
    const branchId = Number(actor.branch_id);
    return this.kitchenService.startItem(id, branchId);
  }

  @Post('items/:id/ready')
  @RequirePermissions('items.write')
  async readyItem(
    @Param('id', ParseIntPipe) id: number,
    @Actor() actor: ActorContext,
  ) {
    const branchId = Number(actor.branch_id);
    return this.kitchenService.readyItem(id, branchId);
  }
}
