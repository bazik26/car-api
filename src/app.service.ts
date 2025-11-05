import { Injectable, Inject, forwardRef } from '@nestjs/common';
import axios from 'axios';
import { LeadService } from './modules/lead/lead.service';
import { LeadSource } from './modules/lead/lead.entity';

@Injectable()
export class AppService {
  public readonly BOT_TOKEN: string = process.env.TELEGRAM_BOT_TOKEN || '8444622269:AAHbHEsMa-0iuzXtbXW7QjtgefyzbZW6Fd4'
  public readonly CHANNEL_ID: number = parseInt(process.env.TELEGRAM_CHANNEL_ID || '-4887008710')

  constructor(
    @Inject(forwardRef(() => LeadService))
    private leadService: LeadService,
  ) {}

  async contactUs(payload: any) {
    const text = `
**📩 Новая заявка**

🌐 **Домен:** ${payload.domain || 'Не указан'}
💬 **Мессенджер:** ${payload.messenger}
👤 **Имя:** ${payload.firstName}
📞 **Телефон:** ${payload.phone}
📧 **Email:** ${payload.email || 'Не указан'}
🚗 **Автомобиль:** ${payload.carInfo || 'Не указан'}
📝 **Комментарий:** ${payload.message || 'Не указано'}
    `;

    try {
      await axios.post(
        `https://api.telegram.org/bot${this.BOT_TOKEN}/sendMessage`,
        {
          chat_id: this.CHANNEL_ID,
          text,
          parse_mode: 'Markdown',
        },
      );

      // Автоматически создаем лид из формы обратной связи
      if (payload.firstName && (payload.phone || payload.email)) {
        try {
          // Определяем источник на основе messenger
          let source = LeadSource.OTHER;
          if (payload.messenger === 'Telegram') {
            source = LeadSource.TELEGRAM;
          } else if (payload.messenger === 'Телефон') {
            source = LeadSource.PHONE;
          } else if (payload.messenger === 'Email') {
            source = LeadSource.EMAIL;
          }

          // Проверяем, есть ли Telegram контакт
          const hasTelegramContact = payload.messenger === 'Telegram';

          await this.leadService.createLead({
            name: payload.firstName,
            email: payload.email,
            phone: payload.phone,
            source: source,
            description: payload.message || payload.carInfo || undefined,
            hasTelegramContact: hasTelegramContact,
          });

          console.log('AppService: Lead automatically created from contact form');
        } catch (error) {
          console.error('AppService: Error creating lead from contact form:', error);
          // Не прерываем выполнение, если не удалось создать лид
        }
      }
    } catch (error) {
      console.error(error.message);
    }
  }

  async sendCarNotification(carData: any, action: string, domain?: string) {
    const actionEmoji = {
      'created': '🚗',
      'updated': '✏️',
      'sold': '💰',
      'available': '✅',
      'deleted': '🗑️'
    };

    const actionText = {
      'created': 'добавлен',
      'updated': 'обновлен',
      'sold': 'отмечен как проданный',
      'available': 'возвращен в статус доступного',
      'deleted': 'удален'
    };

    const text = `
${actionEmoji[action] || '📝'} **Автомобиль ${actionText[action] || action}**

🌐 **Домен:** ${domain || 'Не указан'}
🚗 **Марка:** ${carData.brand}
🏷️ **Модель:** ${carData.model}
📅 **Год:** ${carData.year}
💰 **Цена:** ${carData.price} руб.
📊 **Пробег:** ${carData.mileage} км
⛽ **Двигатель:** ${carData.fuel}, ${carData.engine} л
🔧 **Коробка:** ${carData.gearbox}
🚙 **Привод:** ${carData.drive}
    `;

    try {
      await axios.post(
        `https://api.telegram.org/bot${this.BOT_TOKEN}/sendMessage`,
        {
          chat_id: this.CHANNEL_ID,
          text,
          parse_mode: 'Markdown',
        },
      );
    } catch (error) {
      console.error('Ошибка отправки уведомления о автомобиле:', error.message);
    }
  }
}
