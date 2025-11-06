import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminEntity } from '../db/admin.entity';
import { ProjectType } from '../db/project-type';

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
      // Получаем всех админов, у которых нет projectId или permissions
      const adminsToUpdate = await this.adminRepository
        .createQueryBuilder('admin')
        .where('admin.deletedAt IS NULL')
        .andWhere(
          '(admin.projectId IS NULL OR admin.permissions IS NULL OR admin.permissions = :emptyJson)',
          { emptyJson: '{}' },
        )
        .getMany();

      if (adminsToUpdate.length === 0) {
        console.log('AdminMigrationService: No admins need migration');
        return;
      }

      console.log(
        `AdminMigrationService: Found ${adminsToUpdate.length} admins to migrate`,
      );

      const defaultPermissions = {
        canAddCars: true,
        canViewCars: true,
        canManageLeads: true,
        canViewLeads: true,
      };

      // Обновляем каждого админа
      for (const admin of adminsToUpdate) {
        const updateData: Partial<AdminEntity> = {
          projectId: admin.projectId || ProjectType.OFFICE_1,
          permissions:
            admin.permissions && Object.keys(admin.permissions).length > 0
              ? admin.permissions
              : defaultPermissions,
        };

        await this.adminRepository.update(admin.id, updateData);
        console.log(
          `AdminMigrationService: Updated admin ${admin.id} (${admin.email})`,
        );
      }

      console.log(
        `AdminMigrationService: Successfully migrated ${adminsToUpdate.length} admins`,
      );
    } catch (error) {
      console.error('AdminMigrationService: Error during migration:', error);
      // Не бросаем ошибку, чтобы приложение могло запуститься
    }
  }
}

