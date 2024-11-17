import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { InboxService } from './inbox.service';
import { ApiParam, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InboxGuard } from './inbox.guard';
import { MessageSummery } from './inbox.dto';
import { Account, Message } from '@ltonetwork/lto';
import { Signer } from '../common/http-signature/signer';
import { Response } from 'express';

@ApiTags('Inbox')
@Controller('inboxes')
@UseGuards(InboxGuard)
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get('/:address/hashes')
  @ApiParam({ name: 'address', description: 'Address to get inbox hashes for' })
  async getHashes(@Param('address') address: string, @Signer() signer: Account, @Res() res: Response) {
    if (signer.address !== address) {
      throw new ForbiddenException({ message: 'Unauthorized: Invalid signature for this address' });
    }

    // Fetch message hashes
    const hashes = await this.inbox.getMessageHashes(address);

    // Generate ETag for the current state of the hashes
    const etag = await this.inbox.generateETag(address);

    // Get the Last-Modified timestamp for the inbox
    const lastModified = await this.inbox.getLastModified(address);

    // Set response headers
    res.set({
      ETag: etag,
      'Last-Modified': lastModified.toUTCString(),
    });

    // Return the hashes
    return res.status(200).json({ hashes });
  }

  @Get('/:address')
  @ApiParam({ name: 'address', description: 'Address to get inbox for' })
  @ApiQuery({ name: 'type', description: 'Type of messages to get', required: false })
  @ApiProduces('application/json')
  async list(
    @Param('address') address: string,
    @Signer() signer: Account,
    @Query('type') type?: string,
  ): Promise<MessageSummery[]> {
    if (signer.address !== address) {
      throw new ForbiddenException({ message: 'Unauthorized: Invalid signature for this address' });
    }
    return this.inbox.list(address, type);
  }

  @Get('/:address/:hash')
  @ApiProduces('application/json')
  async get(
    @Param('address') address: string,
    @Param('hash') hash: string,
    @Signer() signer: Account,
  ): Promise<Message> {
    if (signer.address !== address) {
      throw new ForbiddenException({ message: 'Unauthorized: Invalid signature for this address' });
    }

    if (!(await this.inbox.has(address, hash))) {
      throw new NotFoundException({ message: 'Message not found' });
    }
    return await this.inbox.get(address, hash);
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

    if (!(await this.inbox.has(address, hash))) {
      throw new NotFoundException({ message: 'Message not found' });
    }

    await this.inbox.delete(address, hash);
  }
}
