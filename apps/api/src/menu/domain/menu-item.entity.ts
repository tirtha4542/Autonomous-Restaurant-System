export interface MenuItemProps {
  id: number;
  branchId: number;
  name: string;
  description: string;
  price: number;
  station: string;
  allergens: string[];
  imageUrl?: string | null;
  image_url?: string | null;
}

export class MenuItem {
  readonly id: number;
  readonly branchId: number;
  readonly name: string;
  readonly description: string;
  readonly price: number;
  readonly station: string;
  readonly allergens: string[];
  readonly imageUrl?: string | null;
  readonly image_url?: string | null;

  constructor(props: MenuItemProps) {
    this.id = props.id;
    this.branchId = props.branchId;
    this.name = props.name;
    this.description = props.description;
    this.price = props.price;
    this.station = props.station;
    this.allergens = props.allergens;
    this.imageUrl = props.imageUrl ?? props.image_url ?? null;
    this.image_url = props.image_url ?? props.imageUrl ?? null;
  }
}

