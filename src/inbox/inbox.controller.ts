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
import { Account, Message } from '@ltonetwork/lto';
import { Signer } from '../common/http-signature/signer';
import { Response } from 'express';

@ApiTags('Inbox')
@Controller('inboxes')
@UseGuards(InboxGuard)
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
    @Signer() signer: Account,
    @Res() res: Response,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<Response> {
    if (signer.address !== address) {
      throw new ForbiddenException({ message: 'Unauthorized: Invalid signature for this address' });
    }

    const lastModifiedDate = await this.inbox.getLastModified(address);
    const ifModifiedSince = res.req.headers['if-modified-since'];

    if (ifModifiedSince) {
      try {
        const clientDate = new Date(ifModifiedSince);
        if (!isNaN(clientDate.getTime()) && clientDate >= lastModifiedDate) {
          return res.status(304).end();
        }
      } catch {
        throw new BadRequestException('Invalid If-Modified-Since header');
      }
    }

    const limitNumber = limit ? Math.min(Math.max(parseInt(limit, 10) || 100, 1), 100) : 100;
    const offsetNumber = offset ? Math.max(parseInt(offset, 10) || 0, 0) : 0;

    const result = await this.inbox.list(address, {
      limit: limitNumber,
      offset: offsetNumber,
      type,
    });

    res.set({
      'Last-Modified': lastModifiedDate.toUTCString(),
      'Cache-Control': 'private, must-revalidate',
      ETag: `"${lastModifiedDate.getTime()}"`,
    });

    return res.status(200).json({
      messages: result.items,
      total: result.total,
      hasMore: result.hasMore,
      lastModified: lastModifiedDate.toISOString(),
    });
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
