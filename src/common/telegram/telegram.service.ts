import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '../config/config.service';

@Injectable()
export class TelegramService {
  private botToken: string;
  private chatId: string;

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.getTelegramBotToken();
    this.chatId = this.configService.getTelegramChatId();
  }

  async sendMessage(message: string): Promise<void> {
    console.log('ENTERED');
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    console.log(url);
    const sanitizedMessage = this.sanitizeMessage(message);

    try {
      await axios.post(url, {
        chat_id: this.chatId,
        text: sanitizedMessage,
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error('Failed to send message to Telegram:', error.message);
      throw new Error('Telegram message sending failed');
    }
  }

  private sanitizeMessage(message: string): string {
    // Escape HTML special characters to prevent injection
    return message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 4096); // Ensure the message does not exceed Telegram's max length
  }
}
