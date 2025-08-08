import { Injectable } from '@nestjs/common';

import axios from 'axios';

@Injectable()
export class AppService {
  public readonly BOT_TOKEN!: string; //jfksjdok:dsjkfjdksfksjdk
  public readonly CHANNEL_ID!: number; // -1472389478923489237982

  async contactUs(payload: any) {
    const text = `
**📩 Новая заявка**

💬 **Мессенджер:** ${payload.messenger}
👤 **Имя:** ${payload.firstName}
👥 **Фамилия:** ${payload.lastName}
📞 **Телефон:** ${payload.phone}
📝 **Комментарий:** ${payload.message}
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
}
