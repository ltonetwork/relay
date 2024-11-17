import { Message } from '@ltonetwork/lto';
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { DebugService } from './debug.service';

@ApiTags('Debug')
@Controller('debug')
export class DebugController {
  constructor(private readonly message: DebugService) {}

  @Get('/:address/:hash')
  @ApiOperation({ summary: 'Query message metadata only' })
  @ApiProduces('application/json')
  async get(@Param('address') address: string, @Param('hash') hash: string): Promise<Message> {
    if (!(await this.message.has(address, hash))) {
      throw new NotFoundException({ message: 'Message not found' });
    }
    return await this.message.get(address, hash);
  }
}
