import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';

import { Public } from '../auth/public.decorator';

import { AdminService } from './admin.service';

@Controller('/admins')
export class AdminController {
  constructor(protected readonly adminService: AdminService) {}

  @Get('/all')
  @Public()
  async getAdminsAll() {
    return await this.adminService.getAdminsAll();
  }

  @Post('/admin')
  @Public()
  async createAdmin(@Body() admin: any) {
    await this.adminService.createAdmin(admin);
  }

  @Get('/admin/:adminId')
  @Public()
  async getAdmin(@Param('adminId') adminId: number) {
    return await this.adminService.getAdmin(adminId);
  }

  @Delete('/admin/:adminId')
  @Public()
  deleteAdmin(@Param('adminId') adminId: number): Promise<void> {
    return this.adminService.deleteAdmin(adminId);
  }

  @Get('/admin/:adminId/restore')
  @Public()
  restoreAdmin(@Param('adminId') adminId: number): Promise<void> {
    return this.adminService.restoreAdmin(adminId);
  }
}
