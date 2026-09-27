import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class ProcessPaymentDto {
  @IsNotEmpty()
  @IsNumber()
  table_session_id: number;

  @IsOptional()
  @IsNumber()
  order_id?: number;

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsNotEmpty()
  @IsString()
  @IsIn(['cash', 'card', 'digital'])
  method: string;

  @IsOptional()
  close_session?: boolean;
}
