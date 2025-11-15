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
      .leftJoinAndSelect('car.files', 'files', 'files.deletedAt IS NULL')
      .where('car.isSold = :isSold', { isSold: false }) // Только непроданные автомобили
      .andWhere('car.deletedAt IS NULL'); // Только неудаленные автомобили

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
    return await this.carRepo
      .createQueryBuilder('car')
      .leftJoinAndSelect('car.files', 'files', 'files.deletedAt IS NULL')
      .where('car.isSold = :isSold', { isSold: true })
      .andWhere('car.deletedAt IS NULL')
      .orderBy('car.createdAt', 'DESC')
      .limit(limit)
      .getMany();
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
    // Для не-суперадминов фильтруем по projectId админа
    if (this.admin && !this.admin.isSuper) {
      const adminProjectId = this.admin.projectId || ProjectType.OFFICE_1;
      
      console.log(`CarService.getCarsAll: Admin ${this.admin.id} (${this.admin.email}), projectId: ${adminProjectId}`);
      
      // Используем QueryBuilder для более гибкой фильтрации
      // Показываем машины с projectId = adminProjectId ИЛИ (projectId IS NULL И adminId = this.admin.id)
      // Это обеспечивает обратную совместимость с машинами, у которых projectId еще не установлен
      const cars = await this.carRepo
        .createQueryBuilder('car')
        .leftJoinAndSelect('car.files', 'files')
        .where('car.projectId = :projectId', { projectId: adminProjectId })
        .orWhere('(car.projectId IS NULL AND car.adminId = :adminId)', { adminId: this.admin.id })
        .orderBy('car.deletedAt', 'ASC')
        .addOrderBy('car.id', 'DESC')
        .addOrderBy('files.id', 'ASC')
        .withDeleted()
        .getMany();
      
      console.log(`CarService.getCarsAll: Found ${cars.length} cars for admin ${this.admin.id}`);
      return cars;
    }
    
    // Для суперадминов показываем все машины
    const allCars = await this.carRepo.find({
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
    
    console.log(`CarService.getCarsAll: Found ${allCars.length} cars (super admin)`);
    return allCars;
  }

  async createCar(car: CarEntity) {
    if (!this.admin) {
      throw new Error('Админ не авторизован');
    }
    car.admin = this.admin;
    // Всегда устанавливаем projectId на основе админа (безопасность)
    car.projectId = this.admin.projectId || ProjectType.OFFICE_1;

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
    if (!this.admin) {
      throw new Error('Админ не авторизован');
    }
    
    // Проверяем, что админ может редактировать эту машину
    const car = await this.carRepo.findOne({ where: { id: carId } });
    if (!car) {
      throw new Error('Автомобиль не найден');
    }
    
    // Для не-суперадминов проверяем, что машина принадлежит их офису
    if (!this.admin.isSuper) {
      if (car.projectId !== this.admin.projectId) {
        throw new Error('Нет доступа к редактированию этой машины');
      }
      // Всегда устанавливаем projectId на основе админа (безопасность)
      updateData.projectId = this.admin.projectId || ProjectType.OFFICE_1;
    }
    
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
    if (!this.admin) {
      throw new Error('Админ не авторизован');
    }
    
    // Проверяем, что админ может удалить эту машину
    if (!this.admin.isSuper) {
      const car = await this.carRepo.findOne({ where: { id: carId } });
      if (!car) {
        throw new Error('Автомобиль не найден');
      }
      if (car.projectId !== this.admin.projectId) {
        throw new Error('Нет доступа к удалению этой машины');
      }
    }
    
    await this.carRepo.softDelete(carId);
  }

  async restoreCar(carId: number) {
    if (!this.admin) {
      throw new Error('Админ не авторизован');
    }
    
    // Проверяем, что админ может восстановить эту машину
    if (!this.admin.isSuper) {
      const car = await this.carRepo.findOne({ 
        where: { id: carId },
        withDeleted: true 
      });
      if (!car) {
        throw new Error('Автомобиль не найден');
      }
      if (car.projectId !== this.admin.projectId) {
        throw new Error('Нет доступа к восстановлению этой машины');
      }
    }
    
    await this.carRepo.restore({ id: carId });
  }

  async markCarAsSold(carId: number) {
    if (!this.admin) {
      throw new Error('Админ не авторизован');
    }
    
    // Проверяем, что админ может изменить статус этой машины
    if (!this.admin.isSuper) {
      const car = await this.carRepo.findOne({ where: { id: carId } });
      if (!car) {
        throw new Error('Автомобиль не найден');
      }
      if (car.projectId !== this.admin.projectId) {
        throw new Error('Нет доступа к изменению статуса этой машины');
      }
    }
    
    await this.carRepo.update(carId, { isSold: true });
  }

  async markCarAsAvailable(carId: number) {
    if (!this.admin) {
      throw new Error('Админ не авторизован');
    }
    
    // Проверяем, что админ может изменить статус этой машины
    if (!this.admin.isSuper) {
      const car = await this.carRepo.findOne({ where: { id: carId } });
      if (!car) {
        throw new Error('Автомобиль не найден');
      }
      if (car.projectId !== this.admin.projectId) {
        throw new Error('Нет доступа к изменению статуса этой машины');
      }
    }
    
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

  generateYmlXml(cars: CarEntity[], siteId?: string): string {
    // Маппинг сайтов
    const SITE_CONFIG = {
      adenatrans: {
        name: 'Adena Trans',
        companyName: 'Adena Trans Company',
        url: 'https://adenatrans.ru',
        apiImageUrl: 'https://car-api-production.up.railway.app/cars',
      },
      autobroker: {
        name: 'AutoBroker Yar',
        companyName: 'AutoBroker Yar Company',
        url: 'https://autobroker-yar.ru',
        apiImageUrl: 'https://car-api-production.up.railway.app/cars',
      },
      autocars: {
        name: 'Auto C Cars',
        companyName: 'Auto C Cars Company',
        url: 'https://www.auto-c-cars.ru',
        apiImageUrl: 'https://car-api-production.up.railway.app/cars',
      },
    };

    // Получаем конфигурацию сайта (по умолчанию adenatrans)
    const siteConfig = (siteId && SITE_CONFIG[siteId]) || SITE_CONFIG.adenatrans;

    const currentDate = new Date().toISOString();
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
    const ymlHeader = `<yml_catalog date="${currentDate}">
<shop>
<name>${this.escapeXml(siteConfig.name)}</name>
<company>${this.escapeXml(siteConfig.companyName)}</company>
<url>${siteConfig.url}/</url>
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
        const imageUrl = this.getImageUrlForSite(car, siteConfig);

        return `
<offer id="${car.id}" available="true">
<url>${siteConfig.url}/cars/${car.id}</url>
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

  private getImageUrlForSite(car: CarEntity, siteConfig: any): string {
    if (car.files && car.files.length > 0) {
      const firstFile = car.files.find((f) => !f.deletedAt) || car.files[0];
      if (firstFile) {
        // Если path - это полный URL (начинается с http), используем его напрямую
        if (firstFile.path && firstFile.path.startsWith('http')) {
          return firstFile.path;
        }
        
        // Если path - относительный, строим URL через API домена
        const carIdPadded = car.id.toString().padStart(6, '0');
        return `${siteConfig.apiImageUrl}/${carIdPadded}/${firstFile.filename}`;
      }
    }
    return `${siteConfig.apiImageUrl}/${car.id}`;
  }
}
