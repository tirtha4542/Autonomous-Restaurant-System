import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { InternalService } from '../application/internal.service';
import {
  AuditRecordDto,
  ConfirmToolDto,
  ExecuteToolDto,
  ResolveActorDto,
} from '../application/dto/internal.dto';
import { Public } from '../../auth/infrastructure/decorators/public.decorator';

@Public()
@Controller('internal')
export class InternalController {
  constructor(private readonly internalService: InternalService) {}

  /**
   * 1) POST /internal/auth/resolve-actor
   * Request: { "token": "<bearer_token>" }
   * Response: ActorContext JSON
   */
  @Post('auth/resolve-actor')
  @HttpCode(HttpStatus.OK)
  async resolveActor(@Body() dto: ResolveActorDto) {
    return this.internalService.resolveActor(dto.token);
  }

  /**
   * 2) GET /internal/context/bootstrap?actor_id=&branch_id=
   * Response: { "assigned_tables": [...], "active_sessions": [...], ... }
   */
  @Get('context/bootstrap')
  async getBootstrapContext(
    @Query('actor_id') actorId?: string,
    @Query('branch_id') branchId?: string,
  ) {
    return this.internalService.getBootstrapContext(actorId, branchId);
  }

  /**
   * 3) POST /internal/tools/execute
   * Request: { "tool": "get_menu", "args": {...}, "scope": {...}, "actor": ActorContext }
   * Response: ToolResult
   */
  @Post('tools/execute')
  @HttpCode(HttpStatus.OK)
  async executeTool(@Body() dto: ExecuteToolDto) {
    return this.internalService.executeTool(dto);
  }

  /**
   * 4) POST /internal/tools/execute/confirm
   * Request: { "pending_confirmation_id": "...", "actor": ActorContext }
   * Response: ToolResult
   */
  @Post('tools/execute/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmTool(@Body() dto: ConfirmToolDto) {
    return this.internalService.confirmTool(dto);
  }

  /**
   * 5) POST /internal/audit
   * Request: Audit record
   * Response: 202 Accepted
   */
  @Post('audit')
  @HttpCode(HttpStatus.ACCEPTED)
  async writeAudit(@Body() record: AuditRecordDto) {
    await this.internalService.writeAudit(record);
    return { status: 'accepted' };
  }
}
