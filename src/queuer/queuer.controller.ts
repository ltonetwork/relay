import { BadRequestException, Body, Controller, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { LoggerService } from '../common/logger/logger.service';
import { QueuerService } from './queuer.service';
import { Message } from '@ltonetwork/lto';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '../common/config/config.service';

@ApiTags('Send')
@Controller()
export class QueuerController {
  constructor(
    private readonly logger: LoggerService,
    private readonly queuer: QueuerService,
    private readonly config: ConfigService,
  ) {}

  private messageFrom(data: any): Message {
    let message: Message;

    try {
      message = Message.from(data);
    } catch (e) {
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
  @ApiBody({
    description: 'Message to send',
    required: true,
  })
  async add(@Body() data: any, @Res() res: Response): Promise<Response> {
    const message = this.messageFrom(data);

    try {
      await this.queuer.add(message);
    } catch (e) {
      this.logger.warn(`failed to add message to queue '${e}'`, { stack: e.stack });
      return res.status(500).json({ message: `failed to add message to queue` });
    }

    return res.status(204).send();
  }
}
