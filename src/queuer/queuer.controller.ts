import { Post, Req, Res } from '@nestjs/common';
import { Response, Request } from 'express';
import { LoggerService } from '../common/logger/logger.service';
import { QueuerService } from './queuer.service';

export class QueuerController {
  constructor(private readonly logger: LoggerService, private readonly queuerService: QueuerService) {}

  @Post()
  async add(@Req() req: Request, @Res() res: Response): Promise<Response> {
    if (!req.body) {
      return res.status(400).send('invalid body given');
    }

    if (!req.body.id) {
      return res.status(400).send('no id given');
    }

    try {
      await this.queuerService.add(req.body);
    } catch (e) {
      this.logger.error(`failed to add chain to queue '${e}'`, { stack: e.stack });
      return res.status(500).send(`failed to add chain to queue '${e}'`);
    }

    return res.status(204).send();
  }
}
