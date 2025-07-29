import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(protected readonly appService: AppService) {}

  @Get('/all-brands-and-models')
  getBrandsAndModels(): any {
    return this.appService.getAllBrandsAndModels();
  }

  @Get('/cars')
  async getCars() {
    return await this.appService.getCars();
  }

  @Get('/cars/all')
  async getCarsAll() {
    return await this.appService.getCarsAll();
  }

  @Post('/cars')
  async createCar(@Body() car: any) {
    await this.appService.createCar(car);
  }

  @Get('/cars/:carId')
  async getCar(@Param('carId') carId: number) {
    return await this.appService.getCar(carId);
  }

  @Patch('/cars/:carId')
  updateCar(@Param('carId') carId: number, @Body() car: any) {
    return this.appService.updateCar(carId, car);
  }

  @Delete('/cars/:carId')
  deleteCar(@Param('carId') carId: number): Promise<void> {
    return this.appService.deleteCar(carId);
  }

  @Get('/cars/:carId/restore')
  restoreCar(@Param('carId') carId: number): Promise<void> {
    return this.appService.restoreCar(carId);
  }
}
