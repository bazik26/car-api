import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

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
    admin.password = await bcrypt.hash(admin.password, 10);

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

  async updateAdmin(id: number, adminData: Partial<AdminEntity>) {
    if (adminData.password) {
      adminData.password = await bcrypt.hash(adminData.password, 10);
    }
    await this.adminRepo.update(id, adminData);
    return await this.getAdmin(id);
  }
}
