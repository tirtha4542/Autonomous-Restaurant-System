import { OrderStatus } from './order-status.enum';

export interface OrderItemProps {
  id?: number;
  menuItemId: number;
  name?: string;
  price?: number;
  quantity: number;
  station: string;
  modifiers?: Record<string, any>;
  status?: string;
  imageUrl?: string | null;
  image_url?: string | null;
}

export interface OrderProps {
  id?: number;
  tableSessionId: number;
  guestSessionId?: number | null;
  isShared: boolean;
  status: OrderStatus;
  items?: OrderItemProps[];
  tableCode?: string;
  createdAt?: Date;
}

export class Order {
  readonly id?: number;
  readonly tableSessionId: number;
  readonly guestSessionId?: number | null;
  readonly isShared: boolean;
  private _status: OrderStatus;
  readonly items: OrderItemProps[];
  readonly tableCode?: string;
  readonly createdAt?: Date;

  constructor(props: OrderProps) {
    this.id = props.id;
    this.tableSessionId = props.tableSessionId;
    this.guestSessionId = props.guestSessionId;
    this.isShared = props.isShared;
    this._status = props.status;
    this.items = props.items || [];
    this.tableCode = props.tableCode;
    this.createdAt = props.createdAt;
  }

  get status(): OrderStatus {
    return this._status;
  }

  accept(): void {
    if (this._status !== OrderStatus.SUBMITTED) {
      throw new Error(`Cannot accept order in status '${this._status}'. Must be SUBMITTED.`);
    }
    this._status = OrderStatus.ACCEPTED;
  }

  reject(): void {
    if (this._status !== OrderStatus.SUBMITTED) {
      throw new Error(`Cannot reject order in status '${this._status}'. Must be SUBMITTED.`);
    }
    this._status = OrderStatus.REJECTED;
  }

  startPreparing(): void {
    if (this._status !== OrderStatus.ACCEPTED) {
      throw new Error(`Cannot start preparing order in status '${this._status}'. Must be ACCEPTED.`);
    }
    this._status = OrderStatus.PREPARING;
  }

  markReady(): void {
    if (this._status !== OrderStatus.PREPARING && this._status !== OrderStatus.ACCEPTED) {
      throw new Error(`Cannot mark order ready from status '${this._status}'. Must be PREPARING or ACCEPTED.`);
    }
    this._status = OrderStatus.READY;
  }

  serve(): void {
    if (this._status !== OrderStatus.READY) {
      throw new Error(`Cannot serve order in status '${this._status}'. Must be READY.`);
    }
    this._status = OrderStatus.SERVED;
  }
}
