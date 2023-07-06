import { Controller, Get, NotFoundException, Param, Res, UseGuards } from '@nestjs/common';
import { InboxService } from './inbox.service';
import { ApiProduces, ApiTags } from '@nestjs/swagger';
import { InboxGuard } from './inbox.guard';
import { MessageSummery } from './inbox.dto';
import { Message } from '@ltonetwork/lto';

@ApiTags('Inbox')
@Controller('inboxes')
@UseGuards(InboxGuard)
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get('/:address')
  async list(@Param() address: string): Promise<MessageSummery[]> {
    return this.inbox.list(address);
  }

  @Get('/:address/:hash')
  @ApiProduces('application/json')
  async get(@Param() address: string, @Param('hash') hash: string): Promise<Message> {
    if (!await this.inbox.has(address, hash)) {
      throw new NotFoundException({ message: 'Message not found' });
    }

    return await this.inbox.get(address, hash);
  }
}
