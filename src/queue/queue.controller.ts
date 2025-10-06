import { BadRequestException, Body, Controller, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { LoggerService } from '../common/logger/logger.service';
import { QueueService } from './queue.service';
// Dynamic import for eqty-core ES module
let Message: any;
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '../common/config/config.service';

@ApiTags('Queue')
@Controller()
export class QueueController {
  constructor(
    private readonly logger: LoggerService,
    private readonly queue: QueueService,
    private readonly config: ConfigService,
  ) {
    this.initializeEqtyCore();
  }

  private async initializeEqtyCore(): Promise<void> {
    const importFn = new Function('specifier', 'return import(specifier)');
    const eqtyCore = await importFn('eqty-core');
    Message = eqtyCore.Message;
  }

  private async messageFrom(data: any): Promise<any> {
    let message: any;

    if (!Message) {
      await this.initializeEqtyCore();
    }

    try {
      message = Message.from(data);
    } catch (e) {
      this.logger.debug(`queue: invalid message given. ${e.message}`, { data });
      throw new BadRequestException({ error: 'invalid body given' });
    }

    if (!this.config.acceptUnsigned() && !message.signature) {
      throw new BadRequestException({ message: 'message is unsigned' });
    }
    if (message.signature && !(await message.verifySignature(async () => true))) {
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
    const message = await this.messageFrom(data);
    try {
      await this.queue.add(message);
    } catch (e) {
      this.logger.warn(`failed to add message to queue '${e}'`, { stack: e.stack });
      return res.status(500).json({ message: `failed to add message to queue` });
    }

    return res.status(204).send();
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send a message to another account (eqty-core format)' })
  @ApiBody({
    description: 'Message wrapped in relay format',
    required: true,
    examples: {
      'application/json': {
        value: {
          message: {
            version: 3,
            meta: { type: 'basic', title: 'Test', description: 'Test message' },
            mediaType: 'text/plain',
            data: 'Hello World',
            timestamp: 1699123456789,
            sender: '0x1234567890123456789012345678901234567890',
            recipient: '0x0987654321098765432109876543210987654321',
            signature:
              '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Message added to queue for delivery' })
  @ApiResponse({ status: 400, description: 'Invalid message format' })
  @ApiResponse({ status: 500, description: 'Failed to add message to queue' })
  async addMessage(@Body() data: any, @Res() res: Response): Promise<Response> {
    try {
      const messageData = data.message;
      if (!messageData) {
        return res.status(400).json({ error: 'Message data is required' });
      }

      this.logger.info(
        `Received message via /messages endpoint from ${messageData.sender} to ${messageData.recipient}`,
      );

      const message = await this.messageFrom(messageData);
      await this.queue.add(message);

      this.logger.info(`Message ${message.hash.base58} added to queue successfully`);

      // Return the message in the expected format
      return res.status(200).json({ message: message.toJSON() });
    } catch (e) {
      this.logger.warn(`failed to add message to queue via /messages endpoint: '${e}'`, { stack: e.stack });
      return res.status(500).json({ message: `failed to add message to queue` });
    }
  }
}
