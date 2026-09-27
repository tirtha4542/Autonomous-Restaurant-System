import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { OrdersService } from '../application/orders.service';
import { CreateOrderDto } from '../application/dto/create-order.dto';
import { Actor } from '../../auth/infrastructure/decorators/actor.decorator';
import { RequirePermissions } from '../../auth/infrastructure/decorators/permissions.decorator';
import { ActorContext } from '../../auth/domain/actor-context.interface';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @RequirePermissions('orders.write')
  async submitOrder(
    @Body() dto: CreateOrderDto,
    @Actor() actor: ActorContext,
  ) {
    return this.ordersService.submitOrder(dto, actor);
  }

  @Get()
  @RequirePermissions('orders.read')
  async getOrders(
    @Query('status') status: string | undefined,
    @Actor() actor: ActorContext,
  ) {
    const branchId = Number(actor.branch_id);
    return this.ordersService.getOrders(branchId, status);
  }

  @Get(':id')
  @RequirePermissions('orders.read')
  async getOrder(
    @Param('id', ParseIntPipe) id: number,
    @Actor() actor: ActorContext,
  ) {
    const branchId = Number(actor.branch_id);
    return this.ordersService.getOrderById(id, branchId);
  }

  @Post(':id/accept')
  @RequirePermissions('orders.write')
  async acceptOrder(
    @Param('id', ParseIntPipe) id: number,
    @Actor() actor: ActorContext,
  ) {
    const branchId = Number(actor.branch_id);
    return this.ordersService.acceptOrder(id, branchId);
  }

  @Post(':id/reject')
  @RequirePermissions('orders.write')
  async rejectOrder(
    @Param('id', ParseIntPipe) id: number,
    @Actor() actor: ActorContext,
  ) {
    const branchId = Number(actor.branch_id);
    return this.ordersService.rejectOrder(id, branchId);
  }

  @Post(':id/serve')
  @RequirePermissions('orders.write')
  async serveOrder(
    @Param('id', ParseIntPipe) id: number,
    @Actor() actor: ActorContext,
  ) {
    const branchId = Number(actor.branch_id);
    return this.ordersService.serveOrder(id, branchId);
  }
}
