import { Injectable } from '@nestjs/common';
import { promisify } from 'util';
import { readFile } from 'fs';
import { ConfigService } from './config/config.service';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  async info(): Promise<object> {
    const data = await promisify(readFile)('package.json', { encoding: 'utf8' });
    const json = JSON.parse(data);

    return {
      name: json.name,
      version: json.version,
      description: json.description,
      env: await this.configService.get('env'),
    };
  }
}
