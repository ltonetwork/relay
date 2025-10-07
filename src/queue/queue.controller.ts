import { BadRequestException, Body, Controller, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { LoggerService } from '../common/logger/logger.service';
import { QueueService } from './queue.service';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '../common/config/config.service';

// Dynamic import for eqty-core ES module
let Message: any;

@ApiTags('Queue')
@Controller()
export class QueueController {
  constructor(
    private readonly logger: LoggerService,
    private readonly queue: QueueService,
    private readonly config: ConfigService,
  ) {
    // Initialize eqty-core asynchronously
    this.initializeEqtyCore().catch((error) => {
      this.logger.error('Failed to initialize eqty-core:', error);
    });
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

    if (!Message) {
      throw new Error('Failed to load eqty-core Message class');
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

    if (message.signature && this.config.acceptUnsigned() === false) {
      try {
        const isValid = await message.verifySignature(async () => true);
        if (!isValid) {
          throw new BadRequestException({ message: 'invalid signature' });
        }
      } catch (e) {
        this.logger.debug(`queue: signature verification failed: ${e.message}`);
        throw new BadRequestException({ message: 'invalid signature' });
      }
    }

    // Verify hash
    if (!message.verifyHash()) {
      throw new BadRequestException({ message: 'invalid hash' });
    }
    return message;
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send a message to another account' })
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
            data: 'JxF12TrwUP45BMd', // base58 encoded "Hello World"
            timestamp: 1699123456789,
            sender: '0x1234567890123456789012345678901234567890',
            recipient: '0x0987654321098765432109876543210987654321',
            signature: 'jntiJoPVGsKyuCdgt5S', // base58 encoded signature
            hash: 'CBGTetKkBq4yyCSJ7EQi5oC17kQtnJdUDUshPBtvvk4L', // base58 encoded hash
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

      const message = await this.messageFrom(messageData);
      await this.queue.add(message);

      return res.status(200).json({ message: message.toJSON() });
    } catch (e) {
      this.logger.warn(`failed to add message to queue: '${e}'`, { stack: e.stack });
      return res.status(500).json({ message: `failed to add message to queue` });
    }
  }
}
