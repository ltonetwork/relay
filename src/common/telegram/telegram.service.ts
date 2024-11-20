import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '../config/config.service';
import { buildAddress, getNetwork, Message } from '@ltonetwork/lto';

@Injectable()
export class TelegramService {
  private botToken: string;
  private chatId: string;

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.getTelegramBotToken();
    this.chatId = this.configService.getTelegramChatId();
  }

  async sendMessage(message: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    const sanitizedMessage = this.sanitizeMessageForMarkdownV2(message);

    try {
      await axios.post(url, {
        chat_id: this.chatId,
        text: sanitizedMessage,
        parse_mode: 'MarkdownV2',
      });
    } catch (error) {
      console.error('Failed to send message to Telegram:', error.message);
      throw new Error('Telegram message sending failed');
    }
  }

  async formatMessageForTelegram(message: Message) {
    const sender = buildAddress(message.sender.publicKey, getNetwork(message.recipient));
    const recipient = message.recipient;
    const messageHash = message.hash.base58;
    const messageSizeBytes = message.isEncrypted() ? message.encryptedData.length : message.data.length;
    const messageSizeMb = (messageSizeBytes / (1024 * 1024)).toFixed(2);
    const network = sender.startsWith('3N') ? 'Testnet' : 'Mainnet';

    const logMessage = `Message Successfully Sent ✅:
_____________________________\n

Network: [${network}]\n
Sender: ${sender}\n
Recipient: ${recipient}\n
Message Hash: ${messageHash}\n
Message Size: ${messageSizeMb} MB`;

    await this.sendMessage(logMessage);
  }

  private sanitizeMessageForMarkdownV2(message: string): string {
    /**
     * - `_` -> `\_`
     * - `*` -> `\*`
     * - `[` -> `\[`
     * - `]` -> `\]`
     * - `(` -> `\(`
     * - `)` -> `\)`
     * - `~` -> `\~`
     * - `>` -> `\>`
     * - `#` -> `\#`
     * - `+` -> `\+`
     * - `-` -> `\-`
     * - `=` -> `\=`
     * - `|` -> `\|`
     * - `{` -> `\{`
     * - `}` -> `\}`
     * - `.` -> `\.`
     * - `!` -> `\!`
     */
    return message
      .replace(/_/g, '\\_')
      .replace(/\*/g, '\\*')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/~/g, '\\~')
      .replace(/`/g, '\\`')
      .replace(/>/g, '\\>')
      .replace(/#/g, '\\#')
      .replace(/\+/g, '\\+')
      .replace(/-/g, '\\-')
      .replace(/=/g, '\\=')
      .replace(/\|/g, '\\|')
      .replace(/{/g, '\\{')
      .replace(/}/g, '\\}')
      .replace(/\./g, '\\.')
      .replace(/!/g, '\\!')
      .slice(0, 4096);
  }
}
