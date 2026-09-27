import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { TableSessionsService } from '../application/table-sessions.service';
import { Public } from '../../auth/infrastructure/decorators/public.decorator';
import { Actor } from '../../auth/infrastructure/decorators/actor.decorator';
import { RequirePermissions } from '../../auth/infrastructure/decorators/permissions.decorator';
import { ActorContext } from '../../auth/domain/actor-context.interface';

class ResolveQrDto {
  @IsNotEmpty()
  @IsString()
  qr_token: string;
}

@Controller('table-sessions')
export class TableSessionsController {
  constructor(private readonly service: TableSessionsService) {}

  @Public()
  @Post('resolve-qr')
  async resolveQr(@Body() dto: ResolveQrDto) {
    return this.service.resolveByQr(dto.qr_token);
  }

  @Public()
  @Get('tables')
  async listTables() {
    return this.service.listTables(8);
  }

  @Get('active')
  @RequirePermissions('tables.read')
  async getActiveSessions(@Actor() actor: ActorContext) {
    const branchId = Number(actor.branch_id);
    return this.service.getActiveSessions(branchId);
  }

  @Get(':id')
  async getSessionDetails(
    @Param('id', ParseIntPipe) id: number,
    @Actor() actor: ActorContext,
  ) {
    const branchId = Number(actor.branch_id);
    return this.service.getSessionDetails(id, branchId);
  }

  @Post(':id/close')
  @RequirePermissions('tables.write')
  async closeSession(
    @Param('id', ParseIntPipe) id: number,
    @Actor() actor: ActorContext,
  ) {
    const branchId = Number(actor.branch_id);
    return this.service.closeSession(id, branchId);
  }
}
