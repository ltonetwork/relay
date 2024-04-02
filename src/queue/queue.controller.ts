import { BadRequestException, Body, Controller, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { LoggerService } from '../common/logger/logger.service';
import { QueueService } from './queue.service';
import { Message } from '@ltonetwork/lto/messages';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '../common/config/config.service';

@ApiTags('Queue')
@Controller()
export class QueueController {
  constructor(
    private readonly logger: LoggerService,
    private readonly queue: QueueService,
    private readonly config: ConfigService,
  ) {}

  private messageFrom(data: any): Message {
    let message: Message;

    try {
      message = Message.from(data);
    } catch (e) {
      this.logger.debug(`queue: invalid message given. ${e.message}`, { data });
      throw new BadRequestException({ error: 'invalid body given' });
    }

    if (!this.config.acceptUnsigned() && !message.signature) {
      throw new BadRequestException({ message: 'message is unsigned' });
    }
    if (message.signature && !message.verifySignature()) {
      throw new BadRequestException({ message: 'invalid signature' });
    }
    if (!message.verifyHash()) {
      throw new BadRequestException({ message: 'invalid hash' });
    }

    return message;
  }

  @Post()
  @ApiOperation({ summary: 'Send a message to another account' })
  @ApiBody({
    description: 'Message to send',
    required: true,
    examples: {
      'application/json': {
        value: {
          type: 'basic',
          sender: { keyType: 'ed25519', publicKey: '3ct1eeZg1ryzz24VHk4CigJxW6Adxh7Syfm459CmGNv2' },
          recipient: '3MsAuZ59xHHa5vmoPG45fBGC7PxLCYQZnbM',
          timestamp: '2023-06-20T21:40:40.268Z',
          mediaType: 'text/plain',
          data: 'test',
        },
      },
    },
  })
  @ApiResponse({ status: 204, description: 'Message added to queue for delivery' })
  async add(@Body() data: any, @Res() res: Response): Promise<Response> {
    const message = this.messageFrom(data);

    try {
      await this.queue.add(message);
    } catch (e) {
      this.logger.warn(`failed to add message to queue '${e}'`, { stack: e.stack });
      return res.status(500).json({ message: `failed to add message to queue` });
    }

    return res.status(204).send();
  }
}
