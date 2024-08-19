import { Controller, Delete, Get, HttpCode, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { InboxService } from './inbox.service';
import { ApiParam, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InboxGuard } from './inbox.guard';
import { MessageSummery } from './inbox.dto';
import { Message } from '@ltonetwork/lto';
import { Signer, PublicKey } from 'src/common/http-signature/signer';

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

  // @Delete('/:address/:hash')
  // @HttpCode(204)
  // @ApiParam({ name: 'address', description: 'Address of the recipient' })
  // @ApiParam({ name: 'hash', description: 'Hash of the message to delete' })
  // async delete(@Param('address') address: string, @Param('hash') hash: string): Promise<void> {
  //   if (!(await this.inbox.has(address, hash))) {
  //     throw new NotFoundException({ message: 'Message not found' });
  //   }
  //   await this.inbox.delete(address, hash);
  // }

  @Delete('/:address/:hash')
  @HttpCode(204)
  @ApiParam({ name: 'address', description: 'Address of the recipient' })
  @ApiParam({ name: 'hash', description: 'Hash of the message to delete' })
  async delete(
    @Param('address') address: string,
    @Param('hash') hash: string,
    @Signer() signer: PublicKey,
  ): Promise<void> {
    console.log(signer);
    if (!(await this.inbox.has(address, hash))) {
      throw new NotFoundException({ message: 'Message not found' });
    }

    if (signer.publicKey !== address) {
      throw new NotFoundException({ message: 'Unauthorized: Invalid signature for this address' });
    }

    await this.inbox.delete(address, hash);
  }
}
