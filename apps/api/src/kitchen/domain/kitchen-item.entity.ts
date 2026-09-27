export interface KitchenItemProps {
  id: number;
  orderId: number;
  menuItemId: number;
  name: string;
  quantity: number;
  station: string;
  status: string;
  tableCode?: string;
  createdAt?: Date;
}

export class KitchenItem {
  readonly id: number;
  readonly orderId: number;
  readonly menuItemId: number;
  readonly name: string;
  readonly quantity: number;
  readonly station: string;
  readonly status: string;
  readonly tableCode?: string;
  readonly createdAt?: Date;

  constructor(props: KitchenItemProps) {
    this.id = props.id;
    this.orderId = props.orderId;
    this.menuItemId = props.menuItemId;
    this.name = props.name;
    this.quantity = props.quantity;
    this.station = props.station;
    this.status = props.status;
    this.tableCode = props.tableCode;
    this.createdAt = props.createdAt;
  }
}
