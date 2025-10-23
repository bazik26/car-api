import { Controller, Get, Param } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('/productivity')
  async getProductivityStats() {
    return this.statsService.getProductivityStats();
  }

  @Get('/admin/:adminId/productivity')
  async getAdminProductivity(@Param('adminId') adminId: number) {
    return this.statsService.getAdminProductivity(adminId);
  }

  @Get('/cars')
  async getCarsStats() {
    return this.statsService.getCarsStats();
  }

  @Get('/errors')
  async getErrorsStats() {
    return this.statsService.getErrorsStats();
  }
}
