import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IMenuRepository, MENU_REPOSITORY } from '../domain/menu.repository.interface';
import { MenuItem } from '../domain/menu-item.entity';

@Injectable()
export class MenuService {
  constructor(
    @Inject(MENU_REPOSITORY)
    private readonly menuRepository: IMenuRepository,
  ) {}

  async getMenuForBranch(branchId: number): Promise<MenuItem[]> {
    return this.menuRepository.findByBranch(branchId);
  }

  async getMenuItemById(id: number, branchId: number): Promise<MenuItem> {
    const item = await this.menuRepository.findById(id, branchId);
    if (!item) {
      throw new NotFoundException(`Menu item #${id} not found in branch #${branchId}`);
    }
    return item;
  }
}
