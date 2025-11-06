import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminEntity } from '../../db/admin.entity';
import { ProjectType } from '../../db/project-type';

@Injectable()
export class AdminMigrationService implements OnModuleInit {
  constructor(
    @InjectRepository(AdminEntity)
    private readonly adminRepository: Repository<AdminEntity>,
  ) {}

  async onModuleInit() {
    console.log('AdminMigrationService: Starting admin data migration...');
    await this.migrateAdminData();
  }

  async migrateAdminData() {
    try {
      // Получаем всех активных админов
      const allAdmins = await this.adminRepository
        .createQueryBuilder('admin')
        .where('admin.deletedAt IS NULL')
        .getMany();

      if (allAdmins.length === 0) {
        console.log('AdminMigrationService: No active admins found');
        return;
      }

      console.log(
        `AdminMigrationService: Found ${allAdmins.length} active admins`,
      );

      const defaultPermissions = {
        canAddCars: true,
        canViewCars: true,
        canManageLeads: true,
        canViewLeads: true,
      };

      let updatedCount = 0;

      // Обновляем каждого админа, у которого нет projectId или permissions
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
        console.log(
          `AdminMigrationService: Updated admin ${admin.id} (${admin.email})`,
        );
      }

      if (updatedCount === 0) {
        console.log('AdminMigrationService: All admins already have projectId and permissions');
      } else {
        console.log(
          `AdminMigrationService: Successfully migrated ${updatedCount} admins`,
        );
      }
    } catch (error) {
      console.error('AdminMigrationService: Error during migration:', error);
      // Не бросаем ошибку, чтобы приложение могло запуститься
    }
  }
}

