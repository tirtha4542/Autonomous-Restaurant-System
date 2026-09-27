export interface TableSessionProps {
  id: number;
  tableId: number;
  branchId: number;
  status: string;
  openedAt: Date;
  closedAt: Date | null;
  tableCode?: string;
  capacity?: number;
}

export class TableSession {
  readonly id: number;
  readonly tableId: number;
  readonly branchId: number;
  readonly status: string;
  readonly openedAt: Date;
  readonly closedAt: Date | null;
  readonly tableCode?: string;
  readonly capacity?: number;

  constructor(props: TableSessionProps) {
    this.id = props.id;
    this.tableId = props.tableId;
    this.branchId = props.branchId;
    this.status = props.status;
    this.openedAt = props.openedAt;
    this.closedAt = props.closedAt;
    this.tableCode = props.tableCode;
    this.capacity = props.capacity;
  }

  isActive(): boolean {
    return this.status === 'active' && this.closedAt === null;
  }
}
