import { IsNotEmpty, IsString } from 'class-validator';

export class CarSearchDTO {
  @IsNotEmpty()
  @IsString()
  и!: string;
}
