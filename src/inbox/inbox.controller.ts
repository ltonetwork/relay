import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { InboxService } from './inbox.service';
import { ApiParam, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InboxGuard } from './inbox.guard';
import { MessageSummery } from './inbox.dto';
import { Message } from '@ltonetwork/lto';

@ApiTags('Inbox')
@Controller('inboxes')
@UseGuards(InboxGuard)
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get('/:address')
  @ApiParam({ name: 'address', description: 'Address to get inbox for' })
  @ApiQuery({ name: 'type', description: 'Type of messages to get', required: false })
  @ApiProduces('application/json')
  async list(@Param('address') address: string, @Query('type') type?: string): Promise<MessageSummery[]> {
    return this.inbox.list(address, type);
  }

  @Get('/:address/:hash')
  @ApiProduces('application/json')
  async get(@Param('address') address: string, @Param('hash') hash: string): Promise<Message> {
    if (!(await this.inbox.has(address, hash))) {
      throw new NotFoundException({ message: 'Message not found' });
    }
    return await this.inbox.get(address, hash);
  }
}
