import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  InternalServerErrorException,
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

  @Get('/:address/list')
  @ApiParam({ name: 'address', description: 'Address to get inbox metadata' })
  async listMetadata(
    @Param('address') address: string,
    @Signer() signer: Account,
    @Res() res: Response,
  ): Promise<void | Response> {
    if (!address) {
      throw new BadRequestException('Address is required');
    }

    if (signer.address !== address) {
      throw new ForbiddenException({
        message: 'Unauthorized: Invalid signature for this address',
      });
    }

    try {
      const lastModifiedDate = await this.inbox.getLastModified(address);

      const ifModifiedSince = res.req.headers['if-modified-since'];
      let clientDate: Date | null = null;

      if (ifModifiedSince) {
        try {
          clientDate = new Date(ifModifiedSince);
          if (isNaN(clientDate.getTime())) {
            throw new Error('Invalid date');
          }
        } catch (error) {
          throw new BadRequestException('Invalid If-Modified-Since header');
        }
      }

      if (clientDate && clientDate >= lastModifiedDate) {
        return res.status(304).end();
      }

      const metadata = await this.inbox.getMessagesMetadata(address);

      res.set({
        'Last-Modified': lastModifiedDate.toUTCString(),
        'Cache-Control': 'no-cache, must-revalidate',
      });

      return res.status(200).json({
        metadata,
        lastModified: lastModifiedDate.toISOString(),
      });
    } catch (error) {
      console.error('Error in listMetadata:', error);
      throw new InternalServerErrorException('Unable to retrieve metadata');
    }
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
