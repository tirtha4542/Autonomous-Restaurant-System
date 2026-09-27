import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { MenuService } from '../application/menu.service';
import { Public } from '../../auth/infrastructure/decorators/public.decorator';
import { Actor } from '../../auth/infrastructure/decorators/actor.decorator';
import { ActorContext } from '../../auth/domain/actor-context.interface';

@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Public()
  @Get()
  async getMenu(
    @Query('branch_id') queryBranchId?: string,
    @Actor() actor?: ActorContext,
  ) {
    const branchId = actor?.branch_id
      ? Number(actor.branch_id)
      : queryBranchId
        ? Number(queryBranchId)
        : 8;

    const items = await this.menuService.getMenuForBranch(branchId);
    return {
      branch_id: branchId,
      items,
    };
  }

  @Public()
  @Get(':id')
  async getMenuItem(
    @Param('id', ParseIntPipe) id: number,
    @Query('branch_id') queryBranchId?: string,
    @Actor() actor?: ActorContext,
  ) {
    const branchId = actor?.branch_id
      ? Number(actor.branch_id)
      : queryBranchId
        ? Number(queryBranchId)
        : 8;

    const item = await this.menuService.getMenuItemById(id, branchId);
    return { item };
  }
}
