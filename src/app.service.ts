import { Injectable } from '@nestjs/common';

import axios from 'axios';

@Injectable()
export class AppService {
  public readonly BOT_TOKEN: string = process.env.TELEGRAM_BOT_TOKEN || '8444622269:AAHbHEsMa-0iuzXtbXW7QjtgefyzbZW6Fd4'
  public readonly CHANNEL_ID: number = parseInt(process.env.TELEGRAM_CHANNEL_ID || '-4887008710')

  async contactUs(payload: any) {
    const text = `
**📩 Новая заявка**

🌐 **Домен:** ${payload.domain || 'Не указан'}
💬 **Мессенджер:** ${payload.messenger}
👤 **Имя:** ${payload.firstName}
📞 **Телефон:** ${payload.phone}
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
