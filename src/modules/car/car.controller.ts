import { extname } from 'path';

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
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';

import { diskStorage } from 'multer';

import { Public } from '../auth/public.decorator';

import { CarService } from './car.service';

@Controller('/cars')
export class CarController {
  constructor(protected readonly carService: CarService) {}

  @Get('/all-brands-and-models')
  @Public()
  getBrandsAndModels(): any {
    return this.carService.getAllBrandsAndModels();
  }

  @Get('/')
  @Public()
  async getCars() {
    return await this.carService.getCars();
  }

  @Get('/all')
  async getCarsAll() {
    return await this.carService.getCarsAll();
  }

  @Post('/car')
  async createCar(@Body() car: any) {
    await this.carService.createCar(car);
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
        destination: './images',
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
    @UploadedFiles() images: Express.Multer.File[],
  ) {
    return this.carService.uploadCarImages(carId, images);
  }

  @Delete('/car/:carId')
  deleteCar(@Param('carId') carId: number): Promise<void> {
    return this.carService.deleteCar(carId);
  }

  @Get('/car/:carId/restore')
  restoreCar(@Param('carId') carId: number): Promise<void> {
    return this.carService.restoreCar(carId);
  }
}
