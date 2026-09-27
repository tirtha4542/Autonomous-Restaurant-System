import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class StaffLoginDto {
  @IsOptional()
  @IsNumber()
  employee_id?: number;

  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  role?: string;
}

export class CustomerLoginDto {
  @IsNotEmpty()
  @IsString()
  qr_token: string;

  @IsOptional()
  @IsString()
  display_name?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
