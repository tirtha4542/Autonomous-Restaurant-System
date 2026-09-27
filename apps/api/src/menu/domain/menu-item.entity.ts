export interface MenuItemProps {
  id: number;
  branchId: number;
  name: string;
  description: string;
  price: number;
  station: string;
  allergens: string[];
}

export class MenuItem {
  readonly id: number;
  readonly branchId: number;
  readonly name: string;
  readonly description: string;
  readonly price: number;
  readonly station: string;
  readonly allergens: string[];

  constructor(props: MenuItemProps) {
    this.id = props.id;
    this.branchId = props.branchId;
    this.name = props.name;
    this.description = props.description;
    this.price = props.price;
    this.station = props.station;
    this.allergens = props.allergens;
  }
}
