import { TableSession } from './table-session.entity';

export const TABLE_SESSION_REPOSITORY = Symbol('TABLE_SESSION_REPOSITORY');

export interface ITableSessionRepository {
  findActiveByTable(tableId: number, branchId: number): Promise<TableSession | null>;
  findById(id: number): Promise<TableSession | null>;
  findActiveByBranch(branchId: number): Promise<TableSession[]>;
  create(data: { table_id: number; branch_id: number }): Promise<TableSession>;
  closeSession(id: number): Promise<TableSession>;
}
