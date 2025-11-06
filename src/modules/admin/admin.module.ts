import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminMigrationService } from './admin-migration.service';

import { AdminEntity } from '../../db/admin.entity';

const ENTITIES = [AdminEntity];

@Module({
  imports: [TypeOrmModule.forFeature(ENTITIES)],
  controllers: [AdminController],
  providers: [AdminService, AdminMigrationService],
})
export class AdminModule {}
