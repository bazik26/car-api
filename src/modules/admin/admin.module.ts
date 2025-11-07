import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminMigrationService } from './admin-migration.service';
import { DataMigrationService } from './data-migration.service';

import { AdminEntity } from '../../db/admin.entity';
import { CarEntity } from '../../db/car.entity';
import { LeadEntity } from '../lead/lead.entity';

const ENTITIES = [AdminEntity, CarEntity, LeadEntity];

@Module({
  imports: [TypeOrmModule.forFeature(ENTITIES)],
  controllers: [AdminController],
  providers: [AdminService, AdminMigrationService, DataMigrationService],
})
export class AdminModule {}
