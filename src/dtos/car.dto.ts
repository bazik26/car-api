import { IsOptional, IsNumber, IsString, IsArray } from 'class-validator';

export class CarSearchDTO {
  @IsOptional()
  @IsString()
  brand!: string;

  @IsOptional()
  @IsString()
  model!: string;

  @IsOptional()
  @IsNumber()
  yearStart!: number;

  @IsOptional()
  @IsNumber()
  yearEnd!: number;

  @IsOptional()
  @IsNumber()
  mileageStart!: number;

  @IsOptional()
  @IsNumber()
  mileageEnd!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gearbox!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fuel!: string[];

  @IsOptional()
  @IsNumber()
  powerValueStart: number;

  @IsOptional()
  @IsNumber()
  powerValueEnd: number;

  @IsOptional()
  @IsNumber()
  engineStart: number;

  @IsOptional()
  @IsNumber()
  engineEnd: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  drive!: string[];

  @IsOptional()
  @IsNumber()
  priceStart: number;

  @IsOptional()
  @IsNumber()
  priceEnd: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  conditionerType!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  windowLifter!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interiorMaterials!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interiorColor!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  powerSteering!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  steeringWheelAdjustment!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  spareWheel!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  headlights!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seatAdjustment!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  memorySeatModule!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seatHeated!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seatVentilation!: string[];

  @IsOptional()
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  limit?: number = 12;

  @IsOptional()
  @IsString()
  projectId?: string;
}
