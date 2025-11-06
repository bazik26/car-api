import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';

import { Request } from 'express';
import { Repository } from 'typeorm';

import { CarSearchDTO } from '../../dtos/car.dto';

import { AdminEntity } from '../../db/admin.entity';
import { ProjectType } from '../../db/project-type';
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

  async getCars(params?: {
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
    random?: boolean;
  }) {
    const queryBuilder = this.carRepo
      .createQueryBuilder('car')
      .leftJoinAndSelect('car.files', 'files')
      .where('car.isSold = :isSold', { isSold: false }); // Только непроданные автомобили

    // Применяем лимит
    if (params?.limit) {
      queryBuilder.limit(params.limit);
    }

    // Применяем сортировку
    if (params?.sortBy && params?.sortOrder) {
      const orderDirection = params.sortOrder === 'ASC' ? 'ASC' : 'DESC';
      queryBuilder.orderBy(`car.${params.sortBy}`, orderDirection);
    } else {
      queryBuilder.orderBy('car.id', 'DESC'); // По умолчанию сортируем по ID
    }

    // Применяем случайную выборку
    if (params?.random) {
      queryBuilder.orderBy('RAND()');
    }

    return await queryBuilder.getMany();
  }

  async getSoldCars(limit: number = 15) {
    return await this.carRepo.find({
      where: { isSold: true },
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
    // Устанавливаем projectId на основе админа, если не указан
    if (!car.projectId) {
      car.projectId = this.admin.projectId || ProjectType.OFFICE_1;
    }

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
        // Сохраняем только имя файла без пути к папке
        // ServeStaticModule раздаёт файлы из /app/images по корню /
        path: file.filename,
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

  async markCarAsSold(carId: number) {
    await this.carRepo.update(carId, { isSold: true });
  }

  async markCarAsAvailable(carId: number) {
    await this.carRepo.update(carId, { isSold: false });
  }

  async getActiveCarsForYml() {
    return await this.carRepo
      .createQueryBuilder('car')
      .leftJoinAndSelect('car.files', 'files', 'files.deletedAt IS NULL')
      .where('car.isSold = :isSold', { isSold: false })
      .andWhere('car.deletedAt IS NULL')
      .orderBy('car.id', 'DESC')
      .getMany();
  }

  generateYmlXml(cars: CarEntity[]): string {
    const currentDate = new Date().toISOString();
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
    const ymlHeader = `<yml_catalog date="${currentDate}">
<shop>
<name>Adena Trans</name>
<company>Adena Trans Company</company>
<url>https://adenatrans.ru/</url>
<currencies>
<currency id="RUB" rate="1"/>
</currencies>
<categories>
<category id="1">Автомобили</category>
<category id="2" parentId="1">Кроссоверы</category>
<category id="3" parentId="1">Седаны</category>
<category id="4" parentId="1">Хэтчбеки</category>
<category id="5" parentId="1">Универсалы</category>
<category id="6" parentId="1">Купе</category>
<category id="7" parentId="1">Кабриолеты</category>
</categories>
<delivery-options>
<option cost="0" days="1-3"/>
</delivery-options>
<offers>`;

    const offersXml = cars
      .filter((car) => !car.deletedAt)
      .map((car) => {
        const categoryId = this.getCategoryId(car);
        const carName = this.generateCarName(car);
        const description = this.generateDescription(car);
        const imageUrl = this.getImageUrl(car);

        return `
<offer id="${car.id}" available="true">
<url>https://adenatrans.ru/car/${car.id}</url>
<price>${car.price || 0}</price>
<currencyId>RUB</currencyId>
<categoryId>${categoryId}</categoryId>
<picture>${imageUrl}</picture>
<vendor>${this.escapeXml(car.brand || '')}</vendor>
<vendorCode>${this.escapeXml(car.vin || '')}</vendorCode>
<name>${this.escapeXml(carName)}</name>
<description>
<![CDATA[${description}]]>
</description>
<pickup>true</pickup>
<delivery>true</delivery>
</offer>`;
      })
      .join('');

    const ymlFooter = `
</offers>
</shop>
</yml_catalog>`;

    return xmlHeader + ymlHeader + offersXml + ymlFooter;
  }

  private getCategoryId(car: CarEntity): number {
    const model = car.model?.toLowerCase() || '';
    if (
      model.includes('x') ||
      model.includes('q') ||
      model.includes('cross') ||
      model.includes('sport') ||
      model.includes('crossover') ||
      model.includes('suv')
    ) {
      return 2; // Кроссоверы
    }
    return 1; // Автомобили (по умолчанию)
  }

  private generateCarName(car: CarEntity): string {
    const year = car.year || '';
    const price = car.price || 0;
    const formattedPrice = price.toLocaleString('ru-RU');

    return `Авто с пробегом ${car.brand} ${car.model} ${year} год. Цена ${formattedPrice} ₽`;
  }

  private generateDescription(car: CarEntity): string {
    const mileage = car.mileage || 0;
    const engine = car.engine || 0;
    const power = car.powerValue || 0;
    const fuel = this.getFuelType(car.fuel || '');
    const drive = this.getDriveType(car.drive || '');
    const gearbox = this.getGearboxType(car.gearbox || '');

    const formattedMileage = mileage.toLocaleString('ru-RU');
    const powerText = power > 0 ? `${power}Л/C` : '';
    const engineText = engine > 0 ? `${engine}л` : '';

    return `Как новый! Состояние идеал ${formattedMileage} км пробег ${engineText}(${powerText}) ${fuel}. ${drive}. ${gearbox}.`;
  }

  private getFuelType(fuel: string): string {
    const fuelLower = fuel.toLowerCase();
    if (fuelLower.includes('дизель') || fuelLower.includes('diesel'))
      return 'Дизель';
    if (fuelLower.includes('гибрид') || fuelLower.includes('hybrid'))
      return 'Гибрид';
    if (fuelLower.includes('электро') || fuelLower.includes('electric'))
      return 'Электро';
    return 'Бензин';
  }

  private getDriveType(drive: string): string {
    const driveLower = drive.toLowerCase();
    if (
      driveLower.includes('полный') ||
      driveLower.includes('awd') ||
      driveLower.includes('4wd')
    )
      return 'Полный привод';
    if (driveLower.includes('задний') || driveLower.includes('rwd'))
      return 'Задний привод';
    return 'Передний привод';
  }

  private getGearboxType(gearbox: string): string {
    const gearboxLower = gearbox.toLowerCase();
    if (gearboxLower.includes('автомат') || gearboxLower.includes('automatic'))
      return 'Автомат';
    if (gearboxLower.includes('механик') || gearboxLower.includes('manual'))
      return 'Механика';
    if (gearboxLower.includes('вариатор') || gearboxLower.includes('cvt'))
      return 'Вариатор';
    return 'Автомат';
  }

  private escapeXml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private getImageUrl(car: CarEntity): string {
    if (car.files && car.files.length > 0) {
      const firstFile = car.files.find((f) => !f.deletedAt) || car.files[0];
      if (firstFile) {
        const carIdPadded = car.id.toString().padStart(6, '0');
        return `https://adenatrans.ru/api/images/cars/${carIdPadded}/${firstFile.filename}`;
      }
    }
    return `https://adenatrans.ru/api/images/cars/${car.id}`;
  }
}
