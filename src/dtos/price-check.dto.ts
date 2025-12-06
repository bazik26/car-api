import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class PriceCheckDTO {
  @IsString()
  brand: string;

  @IsString()
  model: string;

  @IsNumber()
  @Min(1990)
  @Max(2030)
  year: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mileage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(10)
  engine?: number;

  @IsOptional()
  @IsString()
  gearbox?: string;

  @IsOptional()
  @IsString()
  fuel?: string;

  @IsOptional()
  @IsString()
  drive?: string;
}

