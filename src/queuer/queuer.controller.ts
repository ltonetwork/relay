import { Controller, Post, HttpStatus, Req, Res } from '@nestjs/common';
import { Response, Request } from 'express';
import { QueuerService } from './queuer.service';

@Controller('queue')
export class QueuerController {
  constructor(private readonly queuerService: QueuerService) { }

  @Post()
  async add(@Req() req: Request, @Res() res: Response): Promise<Response> {
    if (!req.body) {
      return res.status(HttpStatus.BAD_REQUEST).send('invalid body given');
    }

    if (!req.body.id) {
      return res.status(HttpStatus.BAD_REQUEST).send('no id given');
    }

    try {
      await this.queuerService.add(req.body, req.query.to);
    } catch (e) {
      // @todo: log this
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('failed to add event to queue, something went wrong');
    }

    return res.status(HttpStatus.NO_CONTENT).send();
  }
}
