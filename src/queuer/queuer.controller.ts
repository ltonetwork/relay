import { Controller, Post, Body } from '@nestjs/common';
import { QueuerService } from './queuer.service';

@Controller('queue')
export class QueuerController {
  constructor(private readonly queuerService: QueuerService) { }

  @Post()
  async add(@Body() event): Promise<object> {
    return event;
  }
}
