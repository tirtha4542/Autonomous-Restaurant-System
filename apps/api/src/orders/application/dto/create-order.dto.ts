import { ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsNotEmpty()
  @IsInt()
  menu_item_id: number;

  @IsNotEmpty()
  @IsInt()
  quantity: number;

  @IsOptional()
  modifiers?: Record<string, any>;
}

export class CreateOrderDto {
  @IsOptional()
  @IsInt()
  table_session_id?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
