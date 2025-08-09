import { Body, Controller, Post } from '@nestjs/common';
import { Public } from './modules/auth/public.decorator';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(protected readonly appService: AppService) {}

  @Post('/contact-us')
  @Public()
  async contactUs(@Body() payload: any) {
    try {
      await this.appService.contactUs(payload);
      return { ok: true, message: 'Заявка успешно отправлена' };
    } catch (error) {
      return { ok: false, message: error?.message || 'Ошибка отправки заявки' };
    }
  }
}