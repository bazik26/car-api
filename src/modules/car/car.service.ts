import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';

import { Request } from 'express';
import { Repository } from 'typeorm';

import { CarSearchDTO } from '../../dtos/car.dto';

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

  async getBrandsAndModelsWithCount() {
    const raw = await this.carRepo
      .createQueryBuilder('car')
      .select('car.brand', 'brand')
      .addSelect('car.model', 'model')
      .addSelect('COUNT(car.id)', 'count')
      .groupBy('car.brand')
      .addGroupBy('car.model')
      .getRawMany();

    const result: {
      title: string;
      count: number;
      models: { title: string; count: number }[];
    }[] = [];

    raw.forEach((row) => {
      let brand = result.find((b) => b.title === row.brand);
      if (!brand) {
        brand = { title: row.brand, count: 0, models: [] };
        result.push(brand);
      }

      brand.models.push({
        title: row.model,
        count: Number(row.count),
      });

      brand.count += Number(row.count);
    });

    return result;
  }

  async getCars() {
    return await this.carRepo.find({
      relations: ['files'],
    });
  }

  async getSoldCars(limit: number = 15) {
    return await this.carRepo.find({
      where: { sale: true },
      relations: ['files'],
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  async searchCars(carSearchDTO: CarSearchDTO) {
    const qb = this.carRepo
      .createQueryBuilder('car')
      .leftJoinAndSelect('car.files', 'files', 'files.deletedAt IS NULL')
      .where('car.deletedAt IS NULL');

    if (carSearchDTO.brand)
      qb.andWhere('car.brand = :brand', { brand: carSearchDTO.brand });
    if (carSearchDTO.model)
      qb.andWhere('car.model = :model', { model: carSearchDTO.model });

    const addRange = (field: string, start?: number, end?: number) => {
      if (start != null && end != null) {
        qb.andWhere(`car.${field} BETWEEN :${field}Start AND :${field}End`, {
          [`${field}Start`]: start,
          [`${field}End`]: end,
        });
      } else if (start != null) {
        qb.andWhere(`car.${field} >= :${field}Start`, {
          [`${field}Start`]: start,
        });
      } else if (end != null) {
        qb.andWhere(`car.${field} <= :${field}End`, {
          [`${field}End`]: end,
        });
      }
    };

    addRange('year', carSearchDTO.yearStart, carSearchDTO.yearEnd);
    addRange('mileage', carSearchDTO.mileageStart, carSearchDTO.mileageEnd);
    addRange(
      'powerValue',
      carSearchDTO.powerValueStart,
      carSearchDTO.powerValueEnd,
    );
    addRange('engine', carSearchDTO.engineStart, carSearchDTO.engineEnd);
    addRange('price', carSearchDTO.priceStart, carSearchDTO.priceEnd);

    const addIn = (field: keyof CarSearchDTO, column: string) => {
      const val = carSearchDTO[field] as string[] | undefined;
      if (val?.length) {
        qb.andWhere(`car.${column} IN (:...${column})`, { [column]: val });
      }
    };

    addIn('gearbox', 'gearbox');
    addIn('fuel', 'fuel');
    addIn('drive', 'drive');
    addIn('conditionerType', 'conditionerType');
    addIn('windowLifter', 'windowLifter');
    addIn('interiorMaterials', 'interiorMaterials');
    addIn('interiorColor', 'interiorColor');
    addIn('powerSteering', 'powerSteering');
    addIn('steeringWheelAdjustment', 'steeringWheelAdjustment');
    addIn('spareWheel', 'spareWheel');
    addIn('headlights', 'headlights');
    addIn('seatAdjustment', 'seatAdjustment');
    addIn('memorySeatModule', 'memorySeatModule');
    addIn('seatHeated', 'seatHeated');
    addIn('seatVentilation', 'seatVentilation');

    // Добавляем пагинацию
    const page = carSearchDTO.page || 1;
    const limit = carSearchDTO.limit || 12;
    const offset = (page - 1) * limit;

    // Получаем общее количество записей
    const total = await qb.getCount();

    // Получаем данные с пагинацией
    const cars = await qb
      .orderBy('car.id', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();

    return {
      cars,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
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

  async uploadCarImages(carId: number, files: Express.Multer.File[]) {
    const entities = files.map((file) =>
      this.fileRepo.create({
        filename: file.filename,
        mimetype: file.mimetype,
        path: file.path.replace('/data/', ''),
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
