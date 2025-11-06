import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { CarEntity } from '../../db/car.entity';
import { AdminEntity } from '../../db/admin.entity';
import { LeadEntity } from '../lead/lead.entity';

const ENTITIES = [CarEntity, AdminEntity, LeadEntity];

@Module({
  imports: [TypeOrmModule.forFeature(ENTITIES)],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}




