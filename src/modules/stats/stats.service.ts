import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CarEntity } from '../../db/car.entity';
import { AdminEntity } from '../../db/admin.entity';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(CarEntity)
    private readonly carRepository: Repository<CarEntity>,
    @InjectRepository(AdminEntity)
    private readonly adminRepository: Repository<AdminEntity>,
  ) {}

  async getProductivityStats() {
    // Получаем всех админов
    const admins = await this.adminRepository.find({
      where: { deletedAt: null },
      relations: ['cars'],
    });

    // Вычисляем статистику для каждого админа
    const adminStats = admins.map(admin => {
      const carsAdded = admin.cars?.length || 0;
      const soldCars = admin.cars?.filter(car => car.isSold).length || 0;
      const errorsCount = Math.floor(Math.random() * 10); // Временная логика для ошибок
      const productivityScore = carsAdded > 0 ? Math.min(100, (soldCars / carsAdded) * 100) : 0;

      return {
        id: admin.id,
        name: admin.name || admin.email,
        email: admin.email,
        carsAdded,
        soldCars,
        errorsCount,
        productivityScore: Math.round(productivityScore),
        lastActivity: admin.updatedAt,
        isActive: admin.isActive,
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
    const admin = await this.adminRepository.findOne({
      where: { id: adminId, deletedAt: null },
      relations: ['cars'],
    });

    if (!admin) {
      throw new Error('Admin not found');
    }

    const carsAdded = admin.cars?.length || 0;
    const soldCars = admin.cars?.filter(car => car.isSold).length || 0;
    const errorsCount = Math.floor(Math.random() * 10);
    const productivityScore = carsAdded > 0 ? Math.min(100, (soldCars / carsAdded) * 100) : 0;

    return {
      id: admin.id,
      name: admin.name || admin.email,
      email: admin.email,
      carsAdded,
      soldCars,
      errorsCount,
      productivityScore: Math.round(productivityScore),
      lastActivity: admin.updatedAt,
      isActive: admin.isActive,
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
    const monthlyStats = [];
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
