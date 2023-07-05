import { Controller, Get } from '@nestjs/common';
import { InboxService } from './inbox.service';

@Controller('inbox')
export class InboxController {
  constructor(private storage: InboxService) {}

  @Get()
  async list() {

  }
}
