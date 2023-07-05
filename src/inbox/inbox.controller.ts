import { Controller, Get, Param, Res } from '@nestjs/common';
import { InboxService } from './inbox.service';
import { Signer } from '../common/http-signature/signer';
import { Account, Message } from '@ltonetwork/lto';
import { MessageSummery } from './inbox.dto';
import { ApiProduces, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

@ApiTags('Inbox')
@Controller('inbox')
export class InboxController {
  constructor(private storage: InboxService) {}

  @Get()
  async list(@Signer() signer: Account): Promise<MessageSummery[]> {
    return this.storage.list(signer.address);
  }

  @Get('/:hash')
  @ApiProduces('application/json')
  async get(@Signer() signer: Account, @Param('hash') hash: string, @Res() res: Response) {
    if (!await this.storage.has(signer.address, hash)) {
      return res.status(404).send('Message not found');
    }

    const message = await this.storage.get(signer.address, hash);

    return res.status(200).json(message);
  }
}
