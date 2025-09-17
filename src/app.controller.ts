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
  @Post('/test-telegram')
  @Public()
  async testTelegram() {
    try {
      await this.appService.contactUs({
        messenger: 'Test',
        firstName: 'Test User',
        phone: '+7 (999) 123-45-67',
        message: 'Тестовое сообщение для проверки бота'
      });
      return { ok: true, message: 'Тестовое сообщение отправлено в Telegram' };
    } catch (error) {
      return { ok: false, message: error?.message || 'Ошибка отправки тестового сообщения' };
    }
  }
}