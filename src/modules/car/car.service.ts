import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';

import { Request } from 'express';
import { Repository } from 'typeorm';

import { AdminEntity } from '../../db/admin.entity';
import { CarEntity } from '../../db/car.entity';
import { FileEntity } from '../../db/file.entity';

import { BRANDS_AND_MODELS } from './brands';

@Injectable({ scope: Scope.REQUEST })
export class CarService {
  constructor(
    @Inject(REQUEST)
    protected readonly request: Request,

    @InjectRepository(CarEntity)
    protected readonly carRepo: Repository<CarEntity>,

    @InjectRepository(FileEntity)
    protected readonly fileRepo: Repository<FileEntity>,
  ) {}

  protected get admin(): AdminEntity {
    return <AdminEntity>this.request.user;
  }

  getAllBrandsAndModels(): any {
    return BRANDS_AND_MODELS;
  }

  async getCars() {
    return await this.carRepo.find({
      relations: ['files'],
    });
  }

  async getCarsAll() {
    return await this.carRepo.find({
      ...(this.admin.isSuper ? {} : { adminId: this.admin.id }),
      withDeleted: true,
      relations: ['files'],
      order: {
        deletedAt: 'ASC',
        id: 'DESC',
        files: {
          id: 'ASC',
        },
      },
    });
  }

  async createCar(car: CarEntity) {
    car.admin = this.admin;

    return await this.carRepo.save(car);
  }

  async getCar(id: number) {
    return await this.carRepo.findOne({
      where: { id },
      relations: ['files'],
      order: { files: { id: 'ASC' } },
    });
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

  async deleteCarImage(carId: number, fileId) {
    await this.fileRepo.delete(fileId);
  }

  async deleteCar(carId: number) {
    await this.carRepo.softDelete(carId);
  }

  async restoreCar(carId: number) {
    await this.carRepo.restore({ id: carId });
  }
}
