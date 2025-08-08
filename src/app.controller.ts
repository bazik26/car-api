import { Body, Controller, Post } from '@nestjs/common';

import { Public } from './modules/auth/public.decorator';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(protected readonly appService: AppService) {}

  @Post('/contact-us')
  @Public()
  async contactUs(@Body() payload: any) {
    await this.appService.contactUs(payload);
  }
}
