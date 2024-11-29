import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DebugService } from './debug.service';

@Injectable()
export class DebugScheduler implements OnModuleInit {
  constructor(private readonly debugService: DebugService) {}

  onModuleInit(): void {
    this.generateCode();
  }

  @Cron('0 * * * *')
  async generateCode(): Promise<void> {
    await this.debugService.generateValidationCode();
    console.log('New validation code generated and sent to Telegram');
  }
}
