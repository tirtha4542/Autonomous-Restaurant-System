import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { RealtimeService } from '../application/realtime.service';
import { Public } from '../../auth/infrastructure/decorators/public.decorator';
import { Actor } from '../../auth/infrastructure/decorators/actor.decorator';
import { ActorContext } from '../../auth/domain/actor-context.interface';

@Public()
@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  /**
   * Server-Sent Events stream for a branch (waiters, kitchen staff, managers)
   * GET /realtime/events?branch_id=8
   */
  @Sse('events')
  streamBranchEvents(
    @Query('branch_id') queryBranchId?: string,
    @Actor() actor?: ActorContext,
  ): Observable<MessageEvent> {
    const branchId = actor?.branch_id
      ? Number(actor.branch_id)
      : queryBranchId
        ? Number(queryBranchId)
        : 8;

    return this.realtimeService.subscribeBranch(branchId);
  }

  /**
   * Server-Sent Events stream for a customer table session
   * GET /realtime/events/session/:tableSessionId
   */
  @Sse('events/session/:tableSessionId')
  streamSessionEvents(
    @Param('tableSessionId', ParseIntPipe) tableSessionId: number,
  ): Observable<MessageEvent> {
    return this.realtimeService.subscribeSession(tableSessionId);
  }

  /**
   * HTTP query to inspect recent events (e.g. for catch-up or polling fallback)
   * GET /realtime/recent?branch_id=8
   */
  @Get('recent')
  getRecentEvents(
    @Query('branch_id') queryBranchId?: string,
    @Actor() actor?: ActorContext,
  ) {
    const branchId = actor?.branch_id
      ? Number(actor.branch_id)
      : queryBranchId
        ? Number(queryBranchId)
        : 8;

    return this.realtimeService.getRecentEvents(branchId);
  }
}
