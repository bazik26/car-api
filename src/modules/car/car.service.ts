import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { CarEntity } from '../../db/car.entity';
import { FileEntity } from '../../db/file.entity';

import { BRANDS_AND_MODELS } from './brands';

@Injectable()
export class CarService {
  constructor(
    @InjectRepository(CarEntity)
    protected readonly carRepo: Repository<CarEntity>,

    @InjectRepository(FileEntity)
    protected readonly fileRepo: Repository<FileEntity>,
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

  async createCar(car: CarEntity) {
    await this.carRepo.save(car);
  }

  async getCar(id: number) {
    return await this.carRepo.findOne({ where: { id } });
  }

  async updateCar(carId: number, updateData: Partial<CarEntity>) {
    await this.carRepo.update(carId, updateData);
    return await this.getCar(carId);
  }

  async uploadCarImages(carId: number, images: Express.Multer.File[]) {
    const entities = images.map((file) =>
      this.fileRepo.create({
        filename: file.filename,
        mimetype: file.mimetype,
        path: file.path,
        car: {
          id: carId,
        },
      }),
    );

    return await this.fileRepo.save(entities);
  }

  async deleteCar(carId: number) {
    await this.carRepo.softDelete(carId);
  }

  async restoreCar(carId: number) {
    await this.carRepo.restore({ id: carId });
  }
}
