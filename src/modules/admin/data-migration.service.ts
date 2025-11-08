import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminEntity } from '../../db/admin.entity';
import { CarEntity } from '../../db/car.entity';
import { LeadEntity } from '../lead/lead.entity';
import { ProjectType } from '../../db/project-type';

@Injectable()
export class DataMigrationService implements OnModuleInit {
  constructor(
    @InjectRepository(AdminEntity)
    private readonly adminRepository: Repository<AdminEntity>,
    @InjectRepository(CarEntity)
    private readonly carRepository: Repository<CarEntity>,
    @InjectRepository(LeadEntity)
    private readonly leadRepository: Repository<LeadEntity>,
  ) {}

  async onModuleInit() {
    console.log('DataMigrationService: Starting data migration...');
    await this.migrateAllData();
  }

  async migrateAllData() {
    try {
      // Мигрируем админов
      await this.migrateAdmins();
      
      // Мигрируем машины
      await this.migrateCars();
      
      // Мигрируем лиды
      await this.migrateLeads();
      
      console.log('DataMigrationService: Data migration completed successfully');
    } catch (error) {
      console.error('DataMigrationService: Error during migration:', error);
      // Не бросаем ошибку, чтобы приложение могло запуститься
    }
  }

  async migrateAdmins() {
    try {
      const allAdmins = await this.adminRepository
        .createQueryBuilder('admin')
        .where('admin.deletedAt IS NULL')
        .getMany();

      if (allAdmins.length === 0) {
        console.log('DataMigrationService: No active admins found');
        return;
      }

      const defaultPermissions = {
        canAddCars: true,
        canViewCars: true,
        canManageLeads: true,
        canViewLeads: true,
      };

      let updatedCount = 0;

      for (const admin of allAdmins) {
        const needsUpdate =
          !admin.projectId ||
          !admin.permissions ||
          typeof admin.permissions !== 'object' ||
          Object.keys(admin.permissions).length === 0;

        if (!needsUpdate) {
          continue;
        }

        const updateData: Partial<AdminEntity> = {
          projectId: admin.projectId || ProjectType.OFFICE_1,
          permissions:
            admin.permissions &&
            typeof admin.permissions === 'object' &&
            Object.keys(admin.permissions).length > 0
              ? admin.permissions
              : defaultPermissions,
        };

        await this.adminRepository.update(admin.id, updateData);
        updatedCount++;
      }

      if (updatedCount > 0) {
        console.log(
          `DataMigrationService: Updated ${updatedCount} admins with projectId and permissions`,
        );
      }
    } catch (error) {
      console.error('DataMigrationService: Error migrating admins:', error);
    }
  }

  async migrateCars() {
    try {
      // Обновляем все машины, у которых projectId NULL или неверное значение
      const result = await this.carRepository
        .createQueryBuilder()
        .update(CarEntity)
        .set({ projectId: ProjectType.OFFICE_1 })
        .where('projectId IS NULL')
        .orWhere('projectId NOT IN (:...validValues)', {
          validValues: [ProjectType.OFFICE_1, ProjectType.OFFICE_2],
        })
        .execute();

      if (result.affected && result.affected > 0) {
        console.log(
          `DataMigrationService: Updated ${result.affected} cars with projectId = office_1`,
        );
      } else {
        console.log('DataMigrationService: All cars already have valid projectId');
      }
    } catch (error) {
      console.error('DataMigrationService: Error migrating cars:', error);
    }
  }

  async migrateLeads() {
    try {
      // Обновляем все лиды, у которых projectId NULL или неверное значение
      const result = await this.leadRepository
        .createQueryBuilder()
        .update(LeadEntity)
        .set({ projectId: ProjectType.OFFICE_1 })
        .where('projectId IS NULL')
        .orWhere('projectId NOT IN (:...validValues)', {
          validValues: [ProjectType.OFFICE_1, ProjectType.OFFICE_2],
        })
        .execute();

      if (result.affected && result.affected > 0) {
        console.log(
          `DataMigrationService: Updated ${result.affected} leads with projectId = office_1`,
        );
      } else {
        console.log('DataMigrationService: All leads already have valid projectId');
      }
    } catch (error) {
      console.error('DataMigrationService: Error migrating leads:', error);
    }
  }
}



