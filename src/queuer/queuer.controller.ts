import { Body, Controller, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { LoggerService } from '../common/logger/logger.service';
import { QueuerService } from './queuer.service';
import { Message } from '@ltonetwork/lto';

@Controller()
export class QueuerController {
  constructor(private readonly logger: LoggerService, private readonly queuerService: QueuerService) {}

  @Post()
  async add(@Body() data: any, @Res() res: Response): Promise<Response> {
    let message: Message;

    try {
      message = Message.from(data)
    } catch (e) {
      this.logger.error(`failed to process message '${e}'`, { stack: e.stack });
      return res.status(400).json({ message: 'invalid body given' });
    }

    try {
      await this.queuerService.add(message);
    } catch (e) {
      this.logger.error(`failed to add message to queue '${e}'`, { stack: e.stack });
      return res.status(500).json({ message: `failed to add message to queue` });
    }

    return res.status(204).send();
  }
}
