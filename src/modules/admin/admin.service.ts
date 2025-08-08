import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { AdminEntity } from '../../db/admin.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(AdminEntity)
    protected readonly adminRepo: Repository<AdminEntity>,
  ) {}

  async getAdminsAll() {
    return await this.adminRepo.find({
      withDeleted: true,
      order: { deletedAt: 'ASC', id: 'DESC' },
    });
  }

  async createAdmin(admin: AdminEntity) {
    await this.adminRepo.save(admin);
  }

  async getAdmin(id: number) {
    return await this.adminRepo.findOne({ where: { id } });
  }

  async deleteAdmin(adminId: number) {
    await this.adminRepo.softDelete(adminId);
  }

  async restoreAdmin(adminId: number) {
    await this.adminRepo.restore({ id: adminId });
  }
}
