import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { PaymentsService } from '../application/payments.service';
import { ProcessPaymentDto } from '../application/dto/process-payment.dto';
import { Actor } from '../../auth/infrastructure/decorators/actor.decorator';
import { RequirePermissions } from '../../auth/infrastructure/decorators/permissions.decorator';
import { ActorContext } from '../../auth/domain/actor-context.interface';
import { Permissions } from '../../auth/domain/permissions';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('pending-bills')
  @RequirePermissions(Permissions.PAYMENTS_READ)
  async getPendingBills(@Actor() actor: ActorContext) {
    const branchId = Number(actor.branch_id);
    const bills = await this.paymentsService.getPendingBills(branchId);
    return {
      branch_id: branchId,
      bills,
    };
  }

  @Get('bill/:sessionId')
  @RequirePermissions(Permissions.PAYMENTS_READ)
  async getTableBill(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Actor() actor: ActorContext,
  ) {
    const branchId = Number(actor.branch_id);
    const bill = await this.paymentsService.getTableBill(sessionId, branchId);
    return { bill };
  }

  @Post('process')
  @RequirePermissions(Permissions.PAYMENTS_WRITE)
  async processPayment(
    @Body() dto: ProcessPaymentDto,
    @Actor() actor: ActorContext,
  ) {
    return this.paymentsService.processPayment(dto, actor);
  }

  @Get('history')
  @RequirePermissions(Permissions.PAYMENTS_READ)
  async getPaymentHistory(@Actor() actor: ActorContext) {
    const branchId = Number(actor.branch_id);
    const payments = await this.paymentsService.getPaymentHistory(branchId);
    return {
      branch_id: branchId,
      payments,
    };
  }
}
