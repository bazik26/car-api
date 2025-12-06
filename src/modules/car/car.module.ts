import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CarController } from './car.controller';
import { CarService } from './car.service';
import { PriceCheckService } from './price-check.service';

import { CarEntity } from '../../db/car.entity';
import { FileEntity } from '../../db/file.entity';

const ENTITIES = [CarEntity, FileEntity];

@Module({
  imports: [TypeOrmModule.forFeature(ENTITIES)],
  controllers: [CarController],
  providers: [CarService, PriceCheckService],
})
export class CarModule {}
