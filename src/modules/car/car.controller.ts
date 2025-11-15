import { extname, join } from 'path';

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseInterceptors,
  UploadedFiles,
  Query,
  Res,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { createReadStream, existsSync } from 'fs';

import { diskStorage } from 'multer';

import { Public } from '../auth/public.decorator';

import { CarService } from './car.service';

import { CarSearchDTO } from '../../dtos/car.dto';

@Controller('/cars')
export class CarController {
  constructor(protected readonly carService: CarService) {}

  @Get('/all-brands-and-models')
  @Public()
  getBrandsAndModels(): any {
    return this.carService.getAllBrandsAndModels();
  }

  @Get('/brands-and-models-with-count')
  @Public()
  getBrandsAndModelsWithCount(): any {
    return this.carService.getBrandsAndModelsWithCount();
  }

  @Get('/')
  @Public()
  async getCars(
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
    @Query('random') random?: string
  ) {
    return await this.carService.getCars({
      limit,
      sortBy,
      sortOrder,
      random: random === 'true'
    });
  }

  @Get('/sold')
  @Public()
  async getSoldCars(@Query('limit') limit?: number) {
    return await this.carService.getSoldCars(limit || 15);
  }

  @Post('/search')
  @Public()
  async searchCars(@Body() carSearchDTO: CarSearchDTO) {
    return await this.carService.searchCars(carSearchDTO);
  }

  @Get('/all')
  async getCarsAll() {
    return await this.carService.getCarsAll();
  }

  @Post('/car')
  async createCar(@Body() car: any) {
    return await this.carService.createCar(car);
  }

  @Get('/car/:carId')
  @Public()
  async getCar(@Param('carId') carId: number) {
    return await this.carService.getCar(carId);
  }

  @Patch('/car/:carId')
  updateCar(@Param('carId') carId: number, @Body() car: any) {
    return this.carService.updateCar(carId, car);
  }

  @Patch('/car/:carId/images')
  @UseInterceptors(
    FilesInterceptor('images', 20, {
      storage: diskStorage({
        destination: (req, file, callback) => {
          const carId = req.params.carId;
          const paddedCarId = carId.padStart(6, '0');
          const uploadDir = process.env.UPLOAD_DIR || './images';
          const carFolder = join(uploadDir, 'cars', paddedCarId);
          
          // Создаем папку если не существует
          const fs = require('fs');
          if (!fs.existsSync(carFolder)) {
            fs.mkdirSync(carFolder, { recursive: true });
          }
          
          callback(null, carFolder);
        },
        filename: (_, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  uploadCarImages(
    @Param('carId') carId: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.carService.uploadCarImages(carId, files);
  }

  @Delete('/car/:carId/images/image/:fileId')
  deleteCarImage(
    @Param('carId') carId: number,
    @Param('fileId') fileId: number,
  ): Promise<void> {
    return this.carService.deleteCarImage(carId, fileId);
  }

  @Delete('/car/:carId')
  deleteCar(@Param('carId') carId: number): Promise<void> {
    return this.carService.deleteCar(carId);
  }

  @Get('/car/:carId/restore')
  restoreCar(@Param('carId') carId: number): Promise<void> {
    return this.carService.restoreCar(carId);
  }

  @Patch('/car/:carId/mark-sold')
  markCarAsSold(@Param('carId') carId: number): Promise<void> {
    return this.carService.markCarAsSold(carId);
  }

  @Patch('/car/:carId/mark-available')
  markCarAsAvailable(@Param('carId') carId: number): Promise<void> {
    return this.carService.markCarAsAvailable(carId);
  }

  @Get('/yml-export')
  @Public()
  async getYmlExport(@Res() res: Response, @Query('site') site?: string) {
    try {
      const cars = await this.carService.getActiveCarsForYml();
      const xmlContent = this.carService.generateYmlXml(cars, site);

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(xmlContent);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  @Get('/:carId/:filename')
  @Public()
  async getCarImage(
    @Param('carId') carId: string,
    @Param('filename') filename: string,
    @Res() res: Response
  ) {
    try {
      // Добавляем нули впереди для соответствия названиям папок (например: 1855 -> 001855)
      const paddedCarId = carId.padStart(6, '0');
      const filePath = join(process.cwd(), 'images', 'cars', paddedCarId, filename);
      
      if (!existsSync(filePath)) {
        return res.status(404).json({ 
          error: 'Image not found',
          path: filePath 
        });
      }

      // Устанавливаем правильные заголовки для изображений
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', `image/${filename.split('.').pop()}`);
      
      const fileStream = createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}
