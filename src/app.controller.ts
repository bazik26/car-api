import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from './modules/auth/public.decorator';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(protected readonly appService: AppService) {}

  @Post('/contact-us')
  @Public()
  async contactUs(@Body() payload: any, @Req() request: Request) {
    try {
      // Автоматически определяем домен из заголовков
      const domain = request.headers.origin || request.headers.host || 'Неизвестный домен';
      
      // Добавляем информацию о домене к payload
      const enrichedPayload = {
        ...payload,
        domain: domain
      };
      
      await this.appService.contactUs(enrichedPayload);
      return { ok: true, message: 'Заявка успешно отправлена' };
    } catch (error) {
      return { ok: false, message: error?.message || 'Ошибка отправки заявки' };
    }
  }
  @Post('/test-telegram')
  @Public()
  async testTelegram(@Req() request: Request) {
    try {
      const domain = request.headers.origin || request.headers.host || 'localhost:3001';
      
      await this.appService.contactUs({
        domain: domain,
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