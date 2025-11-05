import { Controller, Delete, Get, HttpCode, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { InboxService } from './inbox.service';
import { ApiParam, ApiProduces, ApiQuery, ApiTags, ApiSecurity } from '@nestjs/swagger';
import { SIWEGuard } from '../common/siwe/siwe.guard';
import { MessageSummary } from './inbox.dto';
// Dynamic import for eqty-core ES module
let _Message: any;

@ApiTags('Inbox')
@ApiSecurity('SIWE')
@Controller('inboxes')
@UseGuards(SIWEGuard)
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get('/:address')
  @ApiParam({ name: 'address', description: 'Address to get inbox for' })
  @ApiQuery({ name: 'type', description: 'Type of messages to get', required: false })
  @ApiQuery({ name: 'limit', description: 'Optional limit (default 100, max 100)', required: false })
  @ApiQuery({ name: 'offset', description: 'Optional offset for pagination', required: false })
  @ApiProduces('application/json')
  async list(
    @Param('address') address: string,
    @Query('type') type?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<{ items: MessageSummary[]; total: number; hasMore: boolean }> {
    return this.inbox.list(address.toLowerCase(), { type, limit, offset });
  }

  @Get('/:address/:hash')
  @ApiProduces('application/json')
  async get(@Param('address') address: string, @Param('hash') hash: string): Promise<any> {
    if (!(await this.inbox.has(address.toLowerCase(), hash))) {
      throw new NotFoundException({ message: 'Message not found' });
    }
    return await this.inbox.get(address.toLowerCase(), hash);
  }

  @Delete('/:address/:hash')
  @HttpCode(204)
  @ApiParam({ name: 'address', description: 'Address of the recipient' })
  @ApiParam({ name: 'hash', description: 'Hash of the message to delete' })
  async delete(@Param('address') address: string, @Param('hash') hash: string): Promise<void> {
    if (!(await this.inbox.has(address.toLowerCase(), hash))) {
      throw new NotFoundException({ message: 'Message not found' });
    }

    await this.inbox.delete(address.toLowerCase(), hash);
  }
}

// controller for eqty-core compatibility (with authentication)
@ApiTags('Messages')
@ApiSecurity('SIWE')
@Controller('messages')
export class MessagesController {
  constructor(private readonly inbox: InboxService) {}

  @Get(':address')
  @UseGuards(SIWEGuard)
  @ApiParam({ name: 'address', description: 'Address to get messages for' })
  @ApiQuery({ name: 'type', description: 'Type of messages to get', required: false })
  @ApiProduces('application/json')
  async getMessages(@Param('address') address: string, @Query('type') type?: string): Promise<{ messages: any[] }> {
    const result = await this.inbox.list(address.toLowerCase(), { type });
    return { messages: result.items };
  }

  @Get(':address/:hash')
  @UseGuards(SIWEGuard)
  @ApiParam({ name: 'address', description: 'Address to get message for' })
  @ApiParam({ name: 'hash', description: 'Message hash' })
  @ApiProduces('application/json')
  async getMessage(@Param('address') address: string, @Param('hash') hash: string): Promise<any> {
    if (!(await this.inbox.has(address.toLowerCase(), hash))) {
      throw new NotFoundException({ message: 'Message not found' });
    }
    return await this.inbox.get(address.toLowerCase(), hash);
  }

  @Delete(':address/:hash')
  @HttpCode(204)
  @UseGuards(SIWEGuard)
  @ApiParam({ name: 'address', description: 'Address to delete message for' })
  @ApiParam({ name: 'hash', description: 'Message hash' })
  async deleteMessage(@Param('address') address: string, @Param('hash') hash: string): Promise<void> {
    if (!(await this.inbox.has(address.toLowerCase(), hash))) {
      throw new NotFoundException({ message: 'Message not found' });
    }
    await this.inbox.delete(address.toLowerCase(), hash);
  }
}
