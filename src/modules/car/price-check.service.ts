import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CarEntity } from '../../db/car.entity';

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

interface DromFirm {
  id: number;
  name: string;
  alias: string;
}

interface DromModel {
  id: number;
  name: string;
  alias: string;
}

interface DromBull {
  id: number;
  title: string;
  price: number;
  year: number;
  mileageKm: number;
  engineVolume?: number;
  url: string;
  photos?: { url: string }[];
}

@Injectable()
export class PriceCheckService {
  private readonly logger = new Logger(PriceCheckService.name);
  
  // Кэш для firmId и modelId
  private firmsCache: DromFirm[] | null = null;
  private modelsCache: Map<number, DromModel[]> = new Map();

  // Базовый URL Drom API
  private readonly DROM_API_URL = 'https://api.drom.ru/v1.2';

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

    // Запрашиваем данные с Drom.ru API и локальной БД
    const [dromResult, localResult] = await Promise.allSettled([
      this.searchDromApi(params),
      this.searchLocalDatabase(params),
    ]);

    // Обрабатываем результаты Drom.ru API
    if (dromResult.status === 'fulfilled') {
      if (dromResult.value.length > 0) {
        listings.push(...dromResult.value);
        sources.push('drom.ru');
        debugInfo.push(`Drom.ru API: найдено ${dromResult.value.length}`);
      } else {
        debugInfo.push('Drom.ru API: 0 результатов');
      }
    } else {
      debugInfo.push(`Drom.ru API ошибка: ${dromResult.reason?.message || dromResult.reason}`);
      this.logger.warn(`Drom API error: ${dromResult.reason}`);
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
   * Получить список всех марок (firms) с Drom API
   */
  private async getDromFirms(): Promise<DromFirm[]> {
    if (this.firmsCache) {
      return this.firmsCache;
    }

    try {
      const response = await fetch(`${this.DROM_API_URL}/auto/catalog/firms`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; CarPriceChecker/1.0)',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const firms: DromFirm[] = data.firms || data.data || data || [];
      this.firmsCache = firms;
      this.logger.log(`Loaded ${firms.length} firms from Drom API`);
      return firms;
    } catch (error) {
      this.logger.warn(`Failed to load Drom firms: ${error.message}`);
      return [];
    }
  }

  /**
   * Получить список моделей для марки
   */
  private async getDromModels(firmId: number): Promise<DromModel[]> {
    if (this.modelsCache.has(firmId)) {
      return this.modelsCache.get(firmId)!;
    }

    try {
      const response = await fetch(`${this.DROM_API_URL}/auto/catalog/firms/${firmId}/models`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; CarPriceChecker/1.0)',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const models = data.models || data.data || data || [];
      this.modelsCache.set(firmId, models);
      return models;
    } catch (error) {
      this.logger.warn(`Failed to load Drom models for firm ${firmId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Найти firmId по названию марки
   */
  private async findFirmId(brand: string): Promise<number | null> {
    const firms = await this.getDromFirms();
    
    const brandLower = brand.toLowerCase().trim();
    const brandNormalized = this.normalizeBrandName(brand);
    
    // Точное совпадение
    let firm = firms.find(f => 
      f.name?.toLowerCase() === brandLower ||
      f.alias?.toLowerCase() === brandLower
    );
    
    // Частичное совпадение
    if (!firm) {
      firm = firms.find(f => 
        f.name?.toLowerCase().includes(brandLower) ||
        f.alias?.toLowerCase().includes(brandLower) ||
        brandLower.includes(f.name?.toLowerCase() || '') ||
        brandLower.includes(f.alias?.toLowerCase() || '')
      );
    }

    // Поиск по нормализованному названию
    if (!firm) {
      firm = firms.find(f => 
        f.alias?.toLowerCase() === brandNormalized ||
        f.name?.toLowerCase() === brandNormalized
      );
    }
    
    return firm?.id || null;
  }

  /**
   * Найти modelId по названию модели
   */
  private async findModelId(firmId: number, model: string): Promise<number | null> {
    const models = await this.getDromModels(firmId);
    
    const modelLower = model.toLowerCase().trim();
    const modelNormalized = this.normalizeModelName(model);
    
    // Точное совпадение
    let foundModel = models.find(m => 
      m.name?.toLowerCase() === modelLower ||
      m.alias?.toLowerCase() === modelLower
    );
    
    // Поиск по нормализованному названию (3 Series -> 3-series)
    if (!foundModel) {
      foundModel = models.find(m => 
        m.alias?.toLowerCase() === modelNormalized ||
        m.name?.toLowerCase() === modelNormalized
      );
    }

    // Частичное совпадение
    if (!foundModel) {
      foundModel = models.find(m => {
        const mName = m.name?.toLowerCase() || '';
        const mAlias = m.alias?.toLowerCase() || '';
        return mName.includes(modelLower) || 
               mAlias.includes(modelLower) ||
               modelLower.includes(mName) ||
               modelLower.includes(mAlias);
      });
    }

    // Поиск только по цифрам/буквам (для "3 Series" найти "3-series" или "3er")
    if (!foundModel) {
      const modelDigits = modelLower.replace(/[^\d]/g, '');
      if (modelDigits) {
        foundModel = models.find(m => {
          const aliasDigits = (m.alias || '').replace(/[^\d]/g, '');
          return aliasDigits === modelDigits;
        });
      }
    }
    
    return foundModel?.id || null;
  }

  /**
   * Нормализация названия марки для URL
   */
  private normalizeBrandName(brand: string): string {
    return brand
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/_/g, '-')
      .replace(/mercedes-benz/i, 'mercedes')
      .replace(/land\s*rover/i, 'land-rover')
      .replace(/alfa\s*romeo/i, 'alfa-romeo');
  }

  /**
   * Нормализация названия модели для URL
   */
  private normalizeModelName(model: string): string {
    return model
      .toLowerCase()
      .replace(/\s+series$/i, '-series')  // "3 Series" -> "3-series"
      .replace(/\s+class$/i, '-class')    // "C Class" -> "c-class"
      .replace(/\s+/g, '-')
      .replace(/_/g, '-');
  }

  /**
   * Поиск на Drom.ru через API
   */
  private async searchDromApi(params: PriceCheckParams): Promise<MarketCarListing[]> {
    // Находим firmId и modelId
    const firmId = await this.findFirmId(params.brand);
    if (!firmId) {
      this.logger.warn(`Firm not found for brand: ${params.brand}`);
      throw new Error(`Марка "${params.brand}" не найдена в справочнике Drom`);
    }
    
    this.logger.log(`Found firmId: ${firmId} for brand: ${params.brand}`);

    const modelId = await this.findModelId(firmId, params.model);
    if (!modelId) {
      this.logger.warn(`Model not found for: ${params.model}`);
      throw new Error(`Модель "${params.model}" не найдена в справочнике Drom`);
    }
    
    this.logger.log(`Found modelId: ${modelId} for model: ${params.model}`);

    // Формируем параметры запроса
    const searchParams = new URLSearchParams();
    searchParams.append('firmId', firmId.toString());
    searchParams.append('modelId', modelId.toString());
    
    // Год ±1
    if (params.year) {
      searchParams.append('minYear', (params.year - 1).toString());
      searchParams.append('maxYear', (params.year + 1).toString());
    }

    // Пробег ±30000
    if (params.mileage) {
      searchParams.append('minMileageKm', Math.max(0, params.mileage - 30000).toString());
      searchParams.append('maxMileageKm', (params.mileage + 30000).toString());
    }

    // Объем двигателя ±0.3
    if (params.engine) {
      searchParams.append('minEngineVolume', (params.engine - 0.3).toFixed(1));
      searchParams.append('maxEngineVolume', (params.engine + 0.3).toFixed(1));
    }

    // Только непроданные
    searchParams.append('unsold', 'true');
    // С фотографией
    searchParams.append('withPhoto', 'true');

    const url = `${this.DROM_API_URL}/bulls/search?${searchParams.toString()}`;
    this.logger.log(`Drom API URL: ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; CarPriceChecker/1.0)',
        },
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(`Drom API response: ${response.status} - ${text.substring(0, 200)}`);
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Парсим результаты
      const bulls: DromBull[] = data.bulls || data.data || data.items || data || [];
      
      if (!Array.isArray(bulls)) {
        this.logger.warn(`Unexpected Drom API response format: ${JSON.stringify(data).substring(0, 200)}`);
        return [];
      }

      this.logger.log(`Drom API returned ${bulls.length} bulls`);

      return bulls.map(bull => ({
        title: bull.title || `${params.brand} ${params.model}`,
        price: bull.price || 0,
        year: bull.year || params.year,
        mileage: bull.mileageKm || 0,
        engine: bull.engineVolume,
        link: bull.url || `https://auto.drom.ru/bull/${bull.id}`,
        source: 'drom.ru',
        imageUrl: bull.photos?.[0]?.url,
      })).filter(l => l.price > 0);
    } catch (error) {
      this.logger.warn(`Drom API search failed: ${error.message}`);
      throw error;
    }
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
