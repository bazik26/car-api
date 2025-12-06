import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
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
}

@Injectable()
export class PriceCheckService {
  private readonly logger = new Logger(PriceCheckService.name);

  // Маппинг русских названий марок к латинице для API
  private readonly brandMapping: Record<string, string> = {
    'Audi': 'AUDI',
    'BMW': 'BMW',
    'Mercedes-Benz': 'MERCEDES',
    'Volkswagen': 'VOLKSWAGEN',
    'Toyota': 'TOYOTA',
    'Lexus': 'LEXUS',
    'Honda': 'HONDA',
    'Nissan': 'NISSAN',
    'Mazda': 'MAZDA',
    'Hyundai': 'HYUNDAI',
    'Kia': 'KIA',
    'Ford': 'FORD',
    'Chevrolet': 'CHEVROLET',
    'Opel': 'OPEL',
    'Skoda': 'SKODA',
    'Renault': 'RENAULT',
    'Peugeot': 'PEUGEOT',
    'Citroen': 'CITROEN',
    'Fiat': 'FIAT',
    'Volvo': 'VOLVO',
    'Land Rover': 'LAND_ROVER',
    'Range Rover': 'LAND_ROVER',
    'Jaguar': 'JAGUAR',
    'Porsche': 'PORSCHE',
    'Subaru': 'SUBARU',
    'Mitsubishi': 'MITSUBISHI',
    'Suzuki': 'SUZUKI',
    'Lada': 'VAZ',
    'ВАЗ': 'VAZ',
    'УАЗ': 'UAZ',
    'ГАЗ': 'GAZ',
    'Infiniti': 'INFINITI',
    'Acura': 'ACURA',
    'Cadillac': 'CADILLAC',
    'Chrysler': 'CHRYSLER',
    'Dodge': 'DODGE',
    'Jeep': 'JEEP',
    'Tesla': 'TESLA',
    'Haval': 'HAVAL',
    'Chery': 'CHERY',
    'Geely': 'GEELY',
    'Great Wall': 'GREAT_WALL',
    'Changan': 'CHANGAN',
    'EXEED': 'EXEED',
    'Omoda': 'OMODA',
    'Tank': 'TANK',
  };

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
    const errors: string[] = [];

    // Параллельно запрашиваем данные с разных площадок
    const [autoruResult, dromResult, avitoResult, localResult] = await Promise.allSettled([
      this.searchAutoRu(params),
      this.searchDrom(params),
      this.searchAvito(params),
      this.searchLocalDatabase(params),
    ]);

    // Обрабатываем результаты Auto.ru
    if (autoruResult.status === 'fulfilled' && autoruResult.value.length > 0) {
      listings.push(...autoruResult.value);
      sources.push('auto.ru');
      this.logger.log(`Auto.ru: found ${autoruResult.value.length} listings`);
    } else if (autoruResult.status === 'rejected') {
      errors.push(`Auto.ru: ${autoruResult.reason}`);
      this.logger.warn(`Auto.ru error: ${autoruResult.reason}`);
    }

    // Обрабатываем результаты Drom
    if (dromResult.status === 'fulfilled' && dromResult.value.length > 0) {
      listings.push(...dromResult.value);
      sources.push('drom.ru');
      this.logger.log(`Drom.ru: found ${dromResult.value.length} listings`);
    } else if (dromResult.status === 'rejected') {
      errors.push(`Drom.ru: ${dromResult.reason}`);
      this.logger.warn(`Drom.ru error: ${dromResult.reason}`);
    }

    // Обрабатываем результаты Avito
    if (avitoResult.status === 'fulfilled' && avitoResult.value.length > 0) {
      listings.push(...avitoResult.value);
      sources.push('avito.ru');
      this.logger.log(`Avito.ru: found ${avitoResult.value.length} listings`);
    } else if (avitoResult.status === 'rejected') {
      errors.push(`Avito.ru: ${avitoResult.reason}`);
      this.logger.warn(`Avito.ru error: ${avitoResult.reason}`);
    }

    // Добавляем данные из локальной БД
    if (localResult.status === 'fulfilled' && localResult.value.length > 0) {
      listings.push(...localResult.value);
      sources.push('local_db');
      this.logger.log(`Local DB: found ${localResult.value.length} similar cars`);
    }

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
    // или средняя для максимальной прибыли
    const suggestedPrice = Math.floor(averagePrice * 0.95);

    // Сортируем листинги по релевантности
    const sortedListings = this.sortByRelevance(listings, params);

    return {
      success: true,
      averagePrice,
      minPrice,
      maxPrice,
      medianPrice,
      suggestedPrice,
      listings: sortedListings.slice(0, 20), // Возвращаем топ-20
      totalFound: listings.length,
      sources,
      searchParams: params,
    };
  }

  /**
   * Поиск на Auto.ru через API
   */
  private async searchAutoRu(params: PriceCheckParams): Promise<MarketCarListing[]> {
    try {
      const brandCode = this.brandMapping[params.brand] || params.brand.toUpperCase().replace(/\s+/g, '_');
      const modelCode = params.model.toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_');

      // Формируем параметры запроса
      const searchParams: any = {
        category: 'cars',
        section: 'used',
        catalog_filter: [{
          mark: brandCode,
          model: modelCode,
        }],
        year_from: params.year - 1,
        year_to: params.year + 1,
        sort: 'price-asc',
        page_size: 50,
        output_type: 'list',
      };

      // Добавляем пробег если указан
      if (params.mileage) {
        const mileageRange = 30000; // ±30k км
        searchParams.km_age_from = Math.max(0, params.mileage - mileageRange);
        searchParams.km_age_to = params.mileage + mileageRange;
      }

      // Добавляем объем двигателя если указан
      if (params.engine) {
        const engineTolerance = 0.3;
        searchParams.displacement_from = Math.floor((params.engine - engineTolerance) * 1000);
        searchParams.displacement_to = Math.floor((params.engine + engineTolerance) * 1000);
      }

      const url = 'https://auto.ru/-/ajax/desktop/listing/';
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'x-requested-with': 'XMLHttpRequest',
        },
        body: JSON.stringify(searchParams),
      });

      if (!response.ok) {
        throw new Error(`Auto.ru API returned ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.offers || !Array.isArray(data.offers)) {
        return [];
      }

      return data.offers.map((offer: any) => ({
        title: `${offer.vehicle_info?.mark_info?.name || params.brand} ${offer.vehicle_info?.model_info?.name || params.model}`,
        price: offer.price_info?.price || 0,
        year: offer.documents?.year || params.year,
        mileage: offer.state?.mileage || 0,
        engine: offer.vehicle_info?.tech_param?.displacement ? offer.vehicle_info.tech_param.displacement / 1000 : undefined,
        link: `https://auto.ru${offer.url || ''}`,
        source: 'auto.ru',
        imageUrl: offer.state?.image_urls?.[0]?.sizes?.['320x240'] || undefined,
      }));
    } catch (error) {
      this.logger.warn(`Auto.ru search failed: ${error.message}`);
      // Fallback к парсингу HTML страницы
      return this.scrapeAutoRuFallback(params);
    }
  }

  /**
   * Fallback парсинг Auto.ru через HTML
   */
  private async scrapeAutoRuFallback(params: PriceCheckParams): Promise<MarketCarListing[]> {
    try {
      const brand = params.brand.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
      const model = params.model.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
      
      let url = `https://auto.ru/cars/${brand}/${model}/used/`;
      const queryParts: string[] = [];
      
      if (params.year) {
        queryParts.push(`year_from=${params.year - 1}`, `year_to=${params.year + 1}`);
      }
      
      if (queryParts.length > 0) {
        url += '?' + queryParts.join('&');
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      
      // Ищем JSON данные в HTML
      const jsonMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*({.+?});?\s*<\/script>/);
      if (jsonMatch) {
        try {
          const state = JSON.parse(jsonMatch[1]);
          const offers = state?.listing?.data?.offers || [];
          
          return offers.slice(0, 30).map((offer: any) => ({
            title: offer.vehicle_info?.mark_info?.name + ' ' + offer.vehicle_info?.model_info?.name,
            price: offer.price_info?.price || 0,
            year: offer.documents?.year || params.year,
            mileage: offer.state?.mileage || 0,
            engine: offer.vehicle_info?.tech_param?.displacement ? offer.vehicle_info.tech_param.displacement / 1000 : undefined,
            link: `https://auto.ru${offer.url || ''}`,
            source: 'auto.ru',
            imageUrl: offer.state?.image_urls?.[0]?.sizes?.['320x240'] || undefined,
          }));
        } catch (e) {
          this.logger.warn('Failed to parse Auto.ru JSON data');
        }
      }

      // Парсим цены из HTML с помощью regex
      const priceMatches = html.matchAll(/"price":\s*(\d+)/g);
      const prices: number[] = [];
      for (const match of priceMatches) {
        const price = parseInt(match[1], 10);
        if (price > 100000 && price < 100000000) { // Фильтруем нереальные цены
          prices.push(price);
        }
      }

      // Если нашли цены, создаем примерные листинги
      if (prices.length > 0) {
        const uniquePrices = [...new Set(prices)].slice(0, 20);
        return uniquePrices.map((price, index) => ({
          title: `${params.brand} ${params.model}`,
          price,
          year: params.year,
          mileage: params.mileage || 50000,
          link: url,
          source: 'auto.ru',
        }));
      }

      return [];
    } catch (error) {
      this.logger.warn(`Auto.ru fallback scraping failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Поиск на Drom.ru
   */
  private async searchDrom(params: PriceCheckParams): Promise<MarketCarListing[]> {
    try {
      const brand = params.brand.toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
      const model = params.model.toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');

      let url = `https://auto.drom.ru/${brand}/${model}/`;
      
      // Добавляем параметры
      const queryParts: string[] = [];
      if (params.year) {
        queryParts.push(`minYear=${params.year - 1}`, `maxYear=${params.year + 1}`);
      }
      if (params.mileage) {
        const maxMileage = params.mileage + 30000;
        queryParts.push(`maxRun=${maxMileage}`);
      }
      
      if (queryParts.length > 0) {
        url += 'all/?' + queryParts.join('&');
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ru-RU,ru;q=0.9',
        },
      });

      if (!response.ok) {
        throw new Error(`Drom.ru returned ${response.status}`);
      }

      const html = await response.text();

      // Парсим структурированные данные JSON-LD
      const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
      const listings: MarketCarListing[] = [];

      for (const match of jsonLdMatches) {
        try {
          const jsonData = JSON.parse(match[1]);
          if (jsonData['@type'] === 'Product' || jsonData['@type'] === 'Car') {
            const price = jsonData.offers?.price || jsonData.price;
            if (price && price > 100000) {
              listings.push({
                title: jsonData.name || `${params.brand} ${params.model}`,
                price: parseInt(price, 10),
                year: params.year,
                mileage: params.mileage || 0,
                link: jsonData.url || url,
                source: 'drom.ru',
                imageUrl: jsonData.image,
              });
            }
          }
        } catch (e) {
          // Пропускаем невалидный JSON
        }
      }

      // Если не нашли через JSON-LD, парсим цены из HTML
      if (listings.length === 0) {
        const priceMatches = html.matchAll(/data-price="(\d+)"/g);
        for (const match of priceMatches) {
          const price = parseInt(match[1], 10);
          if (price > 100000 && price < 100000000) {
            listings.push({
              title: `${params.brand} ${params.model}`,
              price,
              year: params.year,
              mileage: params.mileage || 0,
              link: url,
              source: 'drom.ru',
            });
          }
        }

        // Альтернативный парсинг цен
        if (listings.length === 0) {
          const altPriceMatches = html.matchAll(/(\d[\d\s]*)\s*(?:₽|руб)/g);
          for (const match of altPriceMatches) {
            const priceStr = match[1].replace(/\s+/g, '');
            const price = parseInt(priceStr, 10);
            if (price > 100000 && price < 100000000) {
              listings.push({
                title: `${params.brand} ${params.model}`,
                price,
                year: params.year,
                mileage: params.mileage || 0,
                link: url,
                source: 'drom.ru',
              });
            }
          }
        }
      }

      return listings.slice(0, 20);
    } catch (error) {
      this.logger.warn(`Drom.ru search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Поиск на Avito.ru
   */
  private async searchAvito(params: PriceCheckParams): Promise<MarketCarListing[]> {
    try {
      // Avito имеет защиту от парсинга, поэтому используем мобильную версию API
      const brand = encodeURIComponent(params.brand);
      const model = encodeURIComponent(params.model);
      const query = `${params.brand} ${params.model} ${params.year}`;
      
      const url = `https://m.avito.ru/api/11/items?key=af0deccbgcgidddjgnvljitntccdduijhdinfgjgfjir&categoryId=9&locationId=653240&params[110000]=value${this.getAvitoMakeId(params.brand)}&q=${encodeURIComponent(query)}&sort=price`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Avito/65.0 (Android 11; SDK 30)',
          'Accept': 'application/json',
          'Accept-Language': 'ru-RU',
        },
      });

      if (!response.ok) {
        throw new Error(`Avito API returned ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.result?.items) {
        return [];
      }

      return data.result.items
        .filter((item: any) => item.price?.value > 100000)
        .slice(0, 20)
        .map((item: any) => ({
          title: item.title || `${params.brand} ${params.model}`,
          price: item.price?.value || 0,
          year: params.year,
          mileage: params.mileage || 0,
          link: `https://www.avito.ru${item.uri || ''}`,
          source: 'avito.ru',
          imageUrl: item.images?.[0]?.['140x105'] || undefined,
        }));
    } catch (error) {
      this.logger.warn(`Avito.ru search failed: ${error.message}`);
      return this.scrapeAvitoFallback(params);
    }
  }

  /**
   * Fallback парсинг Avito через web
   */
  private async scrapeAvitoFallback(params: PriceCheckParams): Promise<MarketCarListing[]> {
    try {
      const query = encodeURIComponent(`${params.brand} ${params.model} ${params.year}`);
      const url = `https://www.avito.ru/rossiya/avtomobili?q=${query}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
      });

      if (!response.ok) {
        return [];
      }

      const html = await response.text();
      
      // Парсим цены
      const priceMatches = html.matchAll(/data-marker="item-price"[^>]*>[\s\S]*?(\d[\d\s]*)\s*₽/g);
      const listings: MarketCarListing[] = [];

      for (const match of priceMatches) {
        const priceStr = match[1].replace(/\s+/g, '');
        const price = parseInt(priceStr, 10);
        if (price > 100000 && price < 100000000 && listings.length < 20) {
          listings.push({
            title: `${params.brand} ${params.model}`,
            price,
            year: params.year,
            mileage: params.mileage || 0,
            link: url,
            source: 'avito.ru',
          });
        }
      }

      return listings;
    } catch (error) {
      this.logger.warn(`Avito fallback failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Поиск похожих машин в локальной базе данных
   */
  private async searchLocalDatabase(params: PriceCheckParams): Promise<MarketCarListing[]> {
    try {
      const yearRange = 2;
      const mileageRange = 40000;

      const query = this.carRepo.createQueryBuilder('car')
        .where('car.deletedAt IS NULL')
        .andWhere('car.isSold = :isSold', { isSold: false })
        .andWhere('car.brand = :brand', { brand: params.brand })
        .andWhere('car.price > 0');

      // Добавляем фильтр по модели если указана
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
        link: '', // Локальная машина
        source: 'local_db',
      }));
    } catch (error) {
      this.logger.warn(`Local DB search failed: ${error.message}`);
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

    // Базовая цена для марки или дефолт
    let basePrice = basePrices[params.brand] || 1500000;

    // Коррекция на возраст (примерно -8% в год)
    const ageDepreciation = Math.pow(0.92, age);
    basePrice *= ageDepreciation;

    // Коррекция на пробег (примерно -3% за каждые 20к км)
    if (params.mileage) {
      const mileageDepreciation = Math.pow(0.97, params.mileage / 20000);
      basePrice *= mileageDepreciation;
    }

    // Коррекция на объем двигателя
    if (params.engine) {
      if (params.engine > 3.0) {
        basePrice *= 1.15; // Большой мотор дороже
      } else if (params.engine < 1.6) {
        basePrice *= 0.9; // Маленький мотор дешевле
      }
    }

    return Math.floor(basePrice / 10000) * 10000; // Округляем до 10 000 ₽
  }

  /**
   * Сортировка листингов по релевантности
   */
  private sortByRelevance(listings: MarketCarListing[], params: PriceCheckParams): MarketCarListing[] {
    return listings.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Точное совпадение года
      if (a.year === params.year) scoreA += 10;
      if (b.year === params.year) scoreB += 10;

      // Близость по пробегу
      if (params.mileage) {
        const diffA = Math.abs((a.mileage || 0) - params.mileage);
        const diffB = Math.abs((b.mileage || 0) - params.mileage);
        scoreA += Math.max(0, 5 - diffA / 10000);
        scoreB += Math.max(0, 5 - diffB / 10000);
      }

      // Близость по объему двигателя
      if (params.engine && a.engine && b.engine) {
        const diffA = Math.abs(a.engine - params.engine);
        const diffB = Math.abs(b.engine - params.engine);
        if (diffA < diffB) scoreA += 3;
        if (diffB < diffA) scoreB += 3;
      }

      // Приоритет источников (auto.ru > drom > avito > local)
      const sourcePriority: Record<string, number> = {
        'auto.ru': 4,
        'drom.ru': 3,
        'avito.ru': 2,
        'local_db': 1,
      };
      scoreA += sourcePriority[a.source] || 0;
      scoreB += sourcePriority[b.source] || 0;

      return scoreB - scoreA;
    });
  }

  /**
   * Получить ID марки для Avito
   */
  private getAvitoMakeId(brand: string): string {
    const avitoMakeIds: Record<string, string> = {
      'Audi': '100',
      'BMW': '200',
      'Mercedes-Benz': '1900',
      'Toyota': '3200',
      'Volkswagen': '3600',
      'Kia': '1100',
      'Hyundai': '1000',
      'Nissan': '2100',
      'Ford': '600',
      'Chevrolet': '500',
      'Renault': '2600',
      'Lada': '3500',
    };
    return avitoMakeIds[brand] || '';
  }
}

