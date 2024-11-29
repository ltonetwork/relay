import { Controller, Delete, Get, Param, Query, HttpCode, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ApiProduces, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DebugService } from './debug.service';

@ApiTags('Debug')
@Controller('debug')
export class DebugController {
  constructor(private readonly debugService: DebugService) {}

  @Get('/:address/:hash')
  @ApiProduces('application/json')
  async get(@Param('address') address: string, @Param('hash') hash: string): Promise<boolean> {
    return await this.debugService.hasMessage(address, hash);
  }

  @Delete('/:address/:hash')
  @HttpCode(204)
  @ApiParam({ name: 'address', description: 'Address of the recipient' })
  @ApiParam({ name: 'hash', description: 'Hash of the message to delete' })
  @ApiQuery({ name: 'code', description: 'Validation code required for deletion' })
  async delete(
    @Param('address') address: string,
    @Param('hash') hash: string,
    @Query('code') code: string,
  ): Promise<void> {
    const isValidCode = await this.debugService.isValidCode(code);

    if (!isValidCode) {
      throw new ForbiddenException({ message: 'Invalid or expired validation code' });
    }

    const exists = await this.debugService.hasMessage(address, hash);
    if (!exists) {
      throw new NotFoundException({ message: 'Message not found' });
    }

    await this.debugService.deleteMessage(address, hash);
  }
}
