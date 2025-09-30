import { Body, Controller, Post, Req, Get, Param, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from './modules/auth/public.decorator';
import { AppService } from './app.service';
import { readdir } from 'fs/promises';
import { join } from 'path';

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

  @Get('/debug/images')
  @Public()
  async debugImages() {
    try {
      const imagesPath = join(process.cwd(), 'images');
      const carsPath = join(imagesPath, 'cars');
      const exists = require('fs').existsSync(carsPath);
      
      if (!exists) {
        return { 
          error: 'Cars folder not found',
          cwd: process.cwd(),
          imagesPath,
          carsPath
        };
      }
      
      const folders = await readdir(carsPath);
      return {
        cwd: process.cwd(),
        imagesPath,
        carsPath,
        foldersCount: folders.length,
        firstFolders: folders.slice(0, 10)
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  @Get('/images/:filename')
  @Public()
  async getImage(
    @Param('filename') filename: string,
    @Res() res: Response
  ) {
    try {
      const filePath = join(process.cwd(), 'images', filename);
      const { createReadStream, existsSync } = require('fs');
      
      if (!existsSync(filePath)) {
        return res.status(404).json({ 
          error: 'Image not found',
          path: filePath 
        });
      }

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