import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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

  @Post('/cars')
  async createCar(@Body() car: any) {
    await this.appService.createCar(car);
  }

  @Get('/cars/:carIdr')
  async getCar(@Param('carId') carId: number) {
    return await this.appService.getCar(carId);
  }
}
