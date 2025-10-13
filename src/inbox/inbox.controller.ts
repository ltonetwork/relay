import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InboxService } from './inbox.service';
import { ApiParam, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InboxGuard } from './inbox.guard';
import { MessageSummery } from './inbox.dto';
import { Account } from '@ltonetwork/lto';
// Dynamic import for eqty-core ES module
let _Message: any;
import { Signer } from '../common/http-signature/signer';

@ApiTags('Inbox')
@Controller('inboxes')
@UseGuards(InboxGuard)
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get('/:address')
  @ApiParam({ name: 'address', description: 'Address to get inbox for' })
  @ApiQuery({ name: 'type', description: 'Type of messages to get', required: false })
  @ApiProduces('application/json')
  async list(
    @Param('address') address: string,
    @Signer() signer: Account,
    @Query('type') type?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<{ items: MessageSummery[]; total: number; hasMore: boolean }> {
    if (signer.address !== address) {
      throw new ForbiddenException({ message: 'Unauthorized: Invalid signature for this address' });
    }
    return this.inbox.list(address.toLowerCase(), { type, limit, offset });
  }

  @Get('/:address/:hash')
  @ApiProduces('application/json')
  async get(@Param('address') address: string, @Param('hash') hash: string, @Signer() signer: Account): Promise<any> {
    if (signer.address !== address) {
      throw new ForbiddenException({ message: 'Unauthorized: Invalid signature for this address' });
    }

    if (!(await this.inbox.has(address.toLowerCase(), hash))) {
      throw new NotFoundException({ message: 'Message not found' });
    }
    return await this.inbox.get(address.toLowerCase(), hash);
  }

  @Delete('/:address/:hash')
  @HttpCode(204)
  @ApiParam({ name: 'address', description: 'Address of the recipient' })
  @ApiParam({ name: 'hash', description: 'Hash of the message to delete' })
  async delete(
    @Param('address') address: string,
    @Param('hash') hash: string,
    @Signer() signer: Account,
  ): Promise<void> {
    if (signer.address !== address) {
      throw new ForbiddenException({ message: 'Unauthorized: Invalid signature for this address' });
    }

    if (!(await this.inbox.has(address.toLowerCase(), hash))) {
      throw new NotFoundException({ message: 'Message not found' });
    }

    await this.inbox.delete(address.toLowerCase(), hash);
  }
}

// Separate controller for eqty-core compatibility (no authentication)
@ApiTags('Messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly inbox: InboxService) {}

  @Get(':recipient')
  @ApiParam({ name: 'recipient', description: 'Recipient address' })
  @ApiQuery({ name: 'type', description: 'Type of messages to get', required: false })
  @ApiProduces('application/json')
  async getMessages(@Param('recipient') recipient: string, @Query('type') type?: string): Promise<{ messages: any[] }> {
    const result = await this.inbox.list(recipient.toLowerCase(), { type });
    return { messages: result.items };
  }

  @Get(':recipient/:hash')
  @ApiParam({ name: 'recipient', description: 'Recipient address' })
  @ApiParam({ name: 'hash', description: 'Message hash' })
  @ApiProduces('application/json')
  async getMessage(@Param('recipient') recipient: string, @Param('hash') hash: string): Promise<any> {
    if (!(await this.inbox.has(recipient.toLowerCase(), hash))) {
      throw new NotFoundException({ message: 'Message not found' });
    }
    return await this.inbox.get(recipient.toLowerCase(), hash);
  }

  @Delete(':recipient/:hash')
  @HttpCode(204)
  @ApiParam({ name: 'recipient', description: 'Recipient address' })
  @ApiParam({ name: 'hash', description: 'Message hash' })
  async deleteMessage(@Param('recipient') recipient: string, @Param('hash') hash: string): Promise<void> {
    if (!(await this.inbox.has(recipient.toLowerCase(), hash))) {
      throw new NotFoundException({ message: 'Message not found' });
    }
    await this.inbox.delete(recipient.toLowerCase(), hash);
  }
}
