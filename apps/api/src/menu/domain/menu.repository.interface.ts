import { MenuItem } from './menu-item.entity';

export const MENU_REPOSITORY = Symbol('MENU_REPOSITORY');

export interface IMenuRepository {
  findByBranch(branchId: number): Promise<MenuItem[]>;
  findById(id: number, branchId: number): Promise<MenuItem | null>;
}
