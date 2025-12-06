import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CarEntity } from '../../db/car.entity';
import { BRANDS_AND_MODELS } from './brands';

export interface PriceCheckParams {
  brand: string;
  model: string;
  year: number;
  mileage?: number;
  engine?: number;
  gearbox?: string;
  fuel?: string;
  drive?: string;
}

export interface MarketCarListing {
  title: string;
  price: number;
  year: number;
  mileage: number;
  engine?: number;
  link: string;
  source: string;
  imageUrl?: string;
}

export interface PriceCheckResult {
  success: boolean;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  medianPrice: number;
  suggestedPrice: number;
  listings: MarketCarListing[];
  totalFound: number;
  sources: string[];
  searchParams: PriceCheckParams;
  error?: string;
  debug?: string[];
}

@Injectable()
export class PriceCheckService {
  private readonly logger = new Logger(PriceCheckService.name);

  // Используем BRANDS_AND_MODELS для валидации
  private readonly brandsAndModels = BRANDS_AND_MODELS;

  constructor(
    @InjectRepository(CarEntity)
    private readonly carRepo: Repository<CarEntity>,
  ) {}

  /**
   * Основной метод проверки цены на российских площадках
   */
  async checkMarketPrice(params: PriceCheckParams): Promise<PriceCheckResult> {
    this.logger.log(`Checking market price for ${params.brand} ${params.model} ${params.year}`);

    const listings: MarketCarListing[] = [];
    const sources: string[] = [];
    const debugInfo: string[] = [];

    // Параллельно запрашиваем данные с разных площадок
    const [dromResult, autoruResult, localResult] = await Promise.allSettled([
      this.searchDrom(params),
      this.searchAutoRu(params),
      this.searchLocalDatabase(params),
    ]);

    // Обрабатываем результаты Drom
    if (dromResult.status === 'fulfilled') {
      if (dromResult.value.length > 0) {
        listings.push(...dromResult.value);
        sources.push('drom.ru');
        debugInfo.push(`Drom.ru: найдено ${dromResult.value.length}`);
      } else {
        debugInfo.push('Drom.ru: 0 результатов');
      }
    } else {
      debugInfo.push(`Drom.ru ошибка: ${dromResult.reason?.message || dromResult.reason}`);
      this.logger.warn(`Drom error: ${dromResult.reason}`);
    }

    // Обрабатываем результаты Auto.ru
    if (autoruResult.status === 'fulfilled') {
      if (autoruResult.value.length > 0) {
        listings.push(...autoruResult.value);
        sources.push('auto.ru');
        debugInfo.push(`Auto.ru: найдено ${autoruResult.value.length}`);
      } else {
        debugInfo.push('Auto.ru: 0 результатов');
      }
    } else {
      debugInfo.push(`Auto.ru ошибка: ${autoruResult.reason?.message || autoruResult.reason}`);
    }

    // Добавляем данные из локальной БД
    if (localResult.status === 'fulfilled') {
      if (localResult.value.length > 0) {
        listings.push(...localResult.value);
        sources.push('local_db');
        debugInfo.push(`Локальная БД: найдено ${localResult.value.length}`);
      } else {
        debugInfo.push('Локальная БД: 0 результатов');
      }
    }

    this.logger.log(`Total found: ${listings.length} listings from ${sources.join(', ')}`);

    // Если не нашли ничего, возвращаем оценочную цену
    if (listings.length === 0) {
      const estimatedPrice = this.estimatePrice(params);
      return {
        success: false,
        averagePrice: estimatedPrice,
        minPrice: Math.floor(estimatedPrice * 0.8),
        maxPrice: Math.floor(estimatedPrice * 1.2),
        medianPrice: estimatedPrice,
        suggestedPrice: estimatedPrice,
        listings: [],
        totalFound: 0,
        sources: [],
        searchParams: params,
        error: 'Не найдено объявлений на площадках. Показана оценочная цена.',
        debug: debugInfo,
      };
    }

    // Рассчитываем статистику по ценам
    const prices = listings.map(l => l.price).filter(p => p > 0).sort((a, b) => a - b);
    
    const minPrice = prices[0];
    const maxPrice = prices[prices.length - 1];
    const averagePrice = Math.floor(prices.reduce((a, b) => a + b, 0) / prices.length);
    const medianPrice = prices.length % 2 === 0
      ? Math.floor((prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2)
      : prices[Math.floor(prices.length / 2)];

    // Рекомендуемая цена - чуть ниже средней для быстрой продажи
    const suggestedPrice = Math.floor(averagePrice * 0.95);

    // Сортируем листинги по цене
    const sortedListings = listings.sort((a, b) => a.price - b.price);

    return {
      success: true,
      averagePrice,
      minPrice,
      maxPrice,
      medianPrice,
      suggestedPrice,
      listings: sortedListings.slice(0, 30),
      totalFound: listings.length,
      sources,
      searchParams: params,
      debug: debugInfo,
    };
  }

  /**
   * Нормализация названия модели для URL Drom
   * Примеры: "3 Series" -> "3-series", "Land Cruiser Prado" -> "land_cruiser_prado"
   */
  private normalizeModelForUrl(brand: string, model: string): string {
    // Специальные правила для немецких марок
    let normalized = model.toLowerCase();
    
    // BMW: "3 Series" -> "3-series"
    if (brand === 'BMW') {
      normalized = normalized
        .replace(/\s+series$/i, '-series')
        .replace(/\s+gran\s+turismo$/i, '-gran_turismo')
        .replace(/\s+gran\s+coup[eé]$/i, '-gran_coupe')
        .replace(/\s+active\s+tourer$/i, '-active_tourer');
    }
    
    // Mercedes: "A-Class" -> "a-class", "GLA" -> "gla"
    if (brand === 'Mercedes-Benz') {
      normalized = normalized
        .replace(/\s+sedan$/i, '')
        .replace(/\s+estate$/i, '_estate')
        .replace(/\s+all-terrain$/i, '_all-terrain')
        .replace(/\s+coup[eé]$/i, '_coupe')
        .replace(/\s+cabriolet$/i, '_cabriolet');
    }
    
    // Общие преобразования
    normalized = normalized
      .replace(/\s+/g, '_')      // Пробелы -> подчеркивания
      .replace(/[éè]/g, 'e')     // Французские буквы
      .replace(/[^\w-]/g, '');   // Убираем спецсимволы
    
    return normalized;
  }

  /**
   * Нормализация названия бренда для URL Drom
   */
  private normalizeBrandForUrl(brand: string): string {
    const brandMapping: Record<string, string> = {
      'Mercedes-Benz': 'mercedes',
      'Land Rover': 'land_rover',
      'Alfa Romeo': 'alfa_romeo',
      'Great Wall': 'great_wall',
    };
    
    return brandMapping[brand] || brand.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  }

  /**
   * Поиск на Drom.ru через парсинг HTML
   */
  private async searchDrom(params: PriceCheckParams): Promise<MarketCarListing[]> {
    const brand = this.normalizeBrandForUrl(params.brand);
    const model = this.normalizeModelForUrl(params.brand, params.model);
    
    const yearFrom = params.year - 1;
    const yearTo = params.year + 1;

    // URL формат: https://auto.drom.ru/bmw/3-series/?minYear=2019&maxYear=2021
    const url = `https://auto.drom.ru/${brand}/${model}/?minYear=${yearFrom}&maxYear=${yearTo}`;
    
    this.logger.log(`Drom URL: ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      
      // Проверяем, что это не страница 404
      if (html.includes('Запрошенная Вами страница не существует')) {
        this.logger.warn(`Drom: Page not found for ${brand}/${model}`);
        return [];
      }

      const listings: MarketCarListing[] = [];

      // Парсим JSON данные из HTML
      // Ищем паттерн "price":XXXXXX
      const priceMatches = html.matchAll(/"price":(\d+)/g);
      const prices: number[] = [];
      
      for (const match of priceMatches) {
        const price = parseInt(match[1], 10);
        // Фильтруем нереальные цены
        if (price >= 100000 && price <= 50000000) {
          prices.push(price);
        }
      }

      // Парсим годы
      const yearMatches = html.matchAll(/"year":(\d{4})/g);
      const years: number[] = [];
      for (const match of yearMatches) {
        years.push(parseInt(match[1], 10));
      }

      // Парсим пробеги
      const mileageMatches = html.matchAll(/"mileage":(\d+)/g);
      const mileages: number[] = [];
      for (const match of mileageMatches) {
        mileages.push(parseInt(match[1], 10));
      }

      // Парсим ссылки на объявления
      const linkMatches = html.matchAll(/href="(https:\/\/auto\.drom\.ru\/[^"]+\/(\d+)\.html)"/g);
      const links: string[] = [];
      for (const match of linkMatches) {
        if (!links.includes(match[1])) {
          links.push(match[1]);
        }
      }

      // Убираем дубликаты цен и создаем листинги
      const uniquePrices = [...new Set(prices)];
      
      for (let i = 0; i < uniquePrices.length && listings.length < 30; i++) {
        listings.push({
          title: `${params.brand} ${params.model}`,
          price: uniquePrices[i],
          year: years[i] || params.year,
          mileage: mileages[i] || 0,
          link: links[i] || url,
          source: 'drom.ru',
        });
      }

      this.logger.log(`Drom: found ${listings.length} listings`);
      return listings;
    } catch (error) {
      this.logger.warn(`Drom error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Поиск на Auto.ru через парсинг HTML
   */
  private async searchAutoRu(params: PriceCheckParams): Promise<MarketCarListing[]> {
    const brand = this.normalizeBrandForUrl(params.brand);
    // Auto.ru использует другой формат моделей (3er вместо 3-series для BMW)
    const model = this.getAutoruModelUrl(params.brand, params.model);
    
    const yearFrom = params.year - 1;
    const yearTo = params.year + 1;

    // URL формат: https://auto.ru/moskva/cars/bmw/3er/used/?year_from=2019&year_to=2021
    const url = `https://auto.ru/rossiya/cars/${brand}/${model}/used/?year_from=${yearFrom}&year_to=${yearTo}`;
    
    this.logger.log(`Auto.ru URL: ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const listings: MarketCarListing[] = [];

      // Парсим JSON данные из HTML
      const priceMatches = html.matchAll(/"price":(\d+)/g);
      const prices: number[] = [];
      
      for (const match of priceMatches) {
        const price = parseInt(match[1], 10);
        if (price >= 100000 && price <= 50000000) {
          prices.push(price);
        }
      }

      // Убираем дубликаты
      const uniquePrices = [...new Set(prices)];
      
      for (let i = 0; i < uniquePrices.length && listings.length < 30; i++) {
        listings.push({
          title: `${params.brand} ${params.model}`,
          price: uniquePrices[i],
          year: params.year,
          mileage: 0,
          link: url,
          source: 'auto.ru',
        });
      }

      this.logger.log(`Auto.ru: found ${listings.length} listings`);
      return listings;
    } catch (error) {
      this.logger.warn(`Auto.ru error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получить URL модели для Auto.ru
   * Auto.ru использует другой формат: "3er" вместо "3-series", "c_klasse" вместо "c-class"
   */
  private getAutoruModelUrl(brand: string, model: string): string {
    let normalized = model.toLowerCase();
    
    // BMW: "3 Series" -> "3er"
    if (brand === 'BMW') {
      const seriesMatch = normalized.match(/^(\d)\s*series/i);
      if (seriesMatch) {
        return seriesMatch[1] + 'er';
      }
    }
    
    // Mercedes: "C-Class" -> "c_klasse"
    if (brand === 'Mercedes-Benz') {
      const classMatch = normalized.match(/^([a-z]+)-?class/i);
      if (classMatch) {
        return classMatch[1].toLowerCase() + '_klasse';
      }
    }
    
    // Общая нормализация
    return normalized
      .replace(/\s+/g, '_')
      .replace(/-/g, '_')
      .replace(/[éè]/g, 'e');
  }

  /**
   * Проверить, существует ли марка/модель в справочнике
   */
  private validateBrandAndModel(brand: string, model: string): boolean {
    const brandData = this.brandsAndModels.find(b => b.title === brand);
    if (!brandData) return false;
    
    return brandData.models.some(m => m.title === model);
  }

  /**
   * Поиск похожих машин в локальной базе данных
   */
  private async searchLocalDatabase(params: PriceCheckParams): Promise<MarketCarListing[]> {
    try {
      const yearRange = 2;
      const mileageRange = 50000;

      const query = this.carRepo.createQueryBuilder('car')
        .where('car.deletedAt IS NULL')
        .andWhere('car.isSold = :isSold', { isSold: false })
        .andWhere('car.brand = :brand', { brand: params.brand })
        .andWhere('car.price > :minPrice', { minPrice: 100000 });

      // Фильтр по модели
      if (params.model) {
        query.andWhere('car.model = :model', { model: params.model });
      }

      // Фильтр по году
      if (params.year) {
        query.andWhere('car.year BETWEEN :yearFrom AND :yearTo', {
          yearFrom: params.year - yearRange,
          yearTo: params.year + yearRange,
        });
      }

      // Фильтр по пробегу
      if (params.mileage) {
        query.andWhere('car.mileage BETWEEN :mileageFrom AND :mileageTo', {
          mileageFrom: Math.max(0, params.mileage - mileageRange),
          mileageTo: params.mileage + mileageRange,
        });
      }

      const cars = await query.limit(20).getMany();

      return cars.map(car => ({
        title: `${car.brand} ${car.model} ${car.year}`,
        price: car.price,
        year: car.year,
        mileage: car.mileage || 0,
        engine: car.engine ? Number(car.engine) : undefined,
        link: '',
        source: 'local_db',
      }));
    } catch (error) {
      this.logger.warn(`Local DB error: ${error.message}`);
      return [];
    }
  }

  /**
   * Оценочная цена если не нашли объявления
   */
  private estimatePrice(params: PriceCheckParams): number {
    const currentYear = new Date().getFullYear();
    const age = currentYear - params.year;

    // Базовые цены для разных марок (в рублях)
    const basePrices: Record<string, number> = {
      'BMW': 3500000,
      'Mercedes-Benz': 4000000,
      'Audi': 3200000,
      'Lexus': 4500000,
      'Porsche': 8000000,
      'Toyota': 2500000,
      'Honda': 2000000,
      'Nissan': 1800000,
      'Hyundai': 1800000,
      'Kia': 1700000,
      'Volkswagen': 2200000,
      'Skoda': 1600000,
      'Ford': 1500000,
      'Chevrolet': 1400000,
      'Renault': 1200000,
      'Peugeot': 1100000,
      'Citroen': 1000000,
      'Opel': 1200000,
      'Fiat': 900000,
      'Lada': 700000,
      'Haval': 2500000,
      'Chery': 1800000,
      'Geely': 1600000,
    };

    let basePrice = basePrices[params.brand] || 1500000;

    // Коррекция на возраст (-8% в год)
    const ageDepreciation = Math.pow(0.92, age);
    basePrice *= ageDepreciation;

    // Коррекция на пробег (-3% за каждые 20к км)
    if (params.mileage) {
      const mileageDepreciation = Math.pow(0.97, params.mileage / 20000);
      basePrice *= mileageDepreciation;
    }

    // Коррекция на объем двигателя
    if (params.engine) {
      if (params.engine > 3.0) {
        basePrice *= 1.15;
      } else if (params.engine < 1.6) {
        basePrice *= 0.9;
      }
    }

    return Math.floor(basePrice / 10000) * 10000;
  }
}
