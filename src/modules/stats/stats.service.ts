import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CarEntity } from '../../db/car.entity';
import { AdminEntity } from '../../db/admin.entity';
import { LeadEntity } from '../lead/lead.entity';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(CarEntity)
    private readonly carRepository: Repository<CarEntity>,
    @InjectRepository(AdminEntity)
    private readonly adminRepository: Repository<AdminEntity>,
    @InjectRepository(LeadEntity)
    private readonly leadRepository: Repository<LeadEntity>,
  ) {}

  async getProductivityStats() {
    // Получаем всех админов (не удаленных)
    const admins = await this.adminRepository
      .createQueryBuilder('admin')
      .leftJoinAndSelect('admin.cars', 'cars')
      .where('admin.deletedAt IS NULL')
      .getMany();

    // Вычисляем статистику для каждого админа
    const adminStats = admins.map(admin => {
      const carsAdded = admin.cars?.length || 0;
      const soldCars = admin.cars?.filter(car => car.isSold).length || 0;
      const errorsCount = Math.floor(Math.random() * 10); // Временная логика для ошибок
      const productivityScore = carsAdded > 0 ? Math.min(100, (soldCars / carsAdded) * 100) : 0;

      return {
        id: admin.id,
        name: admin.email, // Используем email как имя, так как поля name нет
        email: admin.email,
        carsAdded,
        soldCars,
        errorsCount,
        productivityScore: Math.round(productivityScore),
        lastActivity: admin.updatedAt,
        isActive: !admin.deletedAt, // Активен если не удален
      };
    });

    // Сортируем по продуктивности
    const topProductive = [...adminStats]
      .sort((a, b) => b.carsAdded - a.carsAdded)
      .slice(0, 5);

    const topUnproductive = [...adminStats]
      .sort((a, b) => a.carsAdded - b.carsAdded)
      .slice(0, 5);

    const topProblematic = [...adminStats]
      .sort((a, b) => b.errorsCount - a.errorsCount)
      .slice(0, 3);

    return {
      admins: adminStats,
      topProductive,
      topUnproductive,
      topProblematic,
      totalAdmins: adminStats.length,
      totalCars: adminStats.reduce((sum, admin) => sum + admin.carsAdded, 0),
      totalErrors: adminStats.reduce((sum, admin) => sum + admin.errorsCount, 0),
    };
  }

  async getAdminProductivity(adminId: number) {
    const admin = await this.adminRepository
      .createQueryBuilder('admin')
      .leftJoinAndSelect('admin.cars', 'cars')
      .where('admin.id = :adminId', { adminId })
      .andWhere('admin.deletedAt IS NULL')
      .getOne();

    if (!admin) {
      throw new Error('Admin not found');
    }

    const carsAdded = admin.cars?.length || 0;
    const soldCars = admin.cars?.filter(car => car.isSold).length || 0;
    const errorsCount = Math.floor(Math.random() * 10);
    const productivityScore = carsAdded > 0 ? Math.min(100, (soldCars / carsAdded) * 100) : 0;

    // Получаем статистику по лидам
    const totalLeads = await this.leadRepository.count({ where: { assignedAdminId: adminId } });
    const openLeads = await this.leadRepository.count({ 
      where: { 
        assignedAdminId: adminId,
        status: 'new' 
      } 
    });
    const inProgressLeads = await this.leadRepository.count({ 
      where: { 
        assignedAdminId: adminId,
        status: 'in_progress' 
      } 
    });
    const closedLeads = await this.leadRepository.count({ 
      where: { 
        assignedAdminId: adminId,
        status: 'closed' 
      } 
    });
    const lostLeads = await this.leadRepository.count({ 
      where: { 
        assignedAdminId: adminId,
        status: 'lost' 
      } 
    });

    // Получаем последние операции (последние 10 лидов)
    const recentLeads = await this.leadRepository.find({
      where: { assignedAdminId: adminId },
      order: { updatedAt: 'DESC' },
      take: 10,
      relations: ['assignedAdmin'],
    });

    return {
      id: admin.id,
      name: admin.email, // Используем email как имя
      email: admin.email,
      carsAdded,
      soldCars,
      errorsCount,
      productivityScore: Math.round(productivityScore),
      lastActivity: admin.updatedAt,
      isActive: !admin.deletedAt, // Активен если не удален
      leads: {
        total: totalLeads,
        open: openLeads,
        inProgress: inProgressLeads,
        closed: closedLeads,
        lost: lostLeads,
      },
      recentLeads: recentLeads.map(lead => ({
        id: lead.id,
        name: lead.name,
        status: lead.status,
        priority: lead.priority,
        score: lead.score,
        updatedAt: lead.updatedAt,
      })),
    };
  }

  async getCarsStats() {
    const totalCars = await this.carRepository.count();
    const soldCars = await this.carRepository.count({ where: { isSold: true } });
    const availableCars = totalCars - soldCars;
    const deletedCars = await this.carRepository
      .createQueryBuilder('car')
      .where('car.deletedAt IS NOT NULL')
      .getCount();

    // Статистика по месяцам (последние 12 месяцев)
    const monthlyStats: { month: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const carsInMonth = await this.carRepository
        .createQueryBuilder('car')
        .where('car.createdAt >= :startDate', { startDate: startOfMonth })
        .andWhere('car.createdAt <= :endDate', { endDate: endOfMonth })
        .getCount();

      monthlyStats.push({
        month: date.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }),
        count: carsInMonth,
      });
    }

    return {
      totalCars,
      soldCars,
      availableCars,
      deletedCars,
      monthlyStats,
    };
  }

  async getErrorsStats() {
    // Временная реализация - в будущем можно добавить таблицу ошибок
    const errorTypes = [
      { type: 'Validation Error', count: Math.floor(Math.random() * 20) + 5 },
      { type: 'Database Error', count: Math.floor(Math.random() * 15) + 3 },
      { type: 'Upload Error', count: Math.floor(Math.random() * 10) + 2 },
      { type: 'Authentication Error', count: Math.floor(Math.random() * 8) + 1 },
      { type: 'Other', count: Math.floor(Math.random() * 12) + 2 },
    ];

    const totalErrors = errorTypes.reduce((sum, error) => sum + error.count, 0);

    return {
      errorTypes,
      totalErrors,
      lastUpdated: new Date(),
    };
  }
}
