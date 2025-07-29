import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { Car } from './db/car.entity';

import { BRANDS_AND_MODELS } from './brands';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(Car)
    protected readonly carRepo: Repository<Car>,
  ) {}

  getAllBrandsAndModels(): any {
    return BRANDS_AND_MODELS;
  }

  async getCars() {
    return await this.carRepo.find();
  }

  async getCarsAll() {
    return await this.carRepo.find({
      withDeleted: true,
      order: { deletedAt: 'ASC', id: 'DESC' },
    });
  }

  async createCar(car: any) {
    await this.carRepo.save(car);
  }

  async getCar(id: number) {
    return await this.carRepo.findOne({ where: { id } });
  }

  async updateCar(carId: number, updateData: Partial<Car>) {
    await this.carRepo.update(carId, updateData);
    return await this.getCar(carId);
  }

  async deleteCar(carId: number) {
    await this.carRepo.softDelete(carId);
  }

  async restoreCar(carId: number) {
    await this.carRepo.restore({ id: carId });
  }
}
