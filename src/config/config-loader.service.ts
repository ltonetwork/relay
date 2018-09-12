import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import util from 'util';
import path from 'path';
import fs from 'fs';
import convict from 'convict';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class ConfigLoaderService implements OnModuleInit, OnModuleDestroy {
  private config: convict.Config<object>;
  private readonly ttl: number = 300000; // 5 minutes in milliseconds
  private config_reload_interval: NodeJS.Timer;

  constructor(private readonly logger: LoggerService) { }

  async onModuleInit() {
    if (!this.config) {
      await this.load();
    }

    if (!this.config_reload_interval) {
      this.config_reload_interval = setInterval(async () => {
        await this.load();
      }, this.ttl);
    }
  }

  async onModuleDestroy() {
    if (this.config_reload_interval) {
      clearInterval(this.config_reload_interval);
    }
  }

  private async load(): Promise<void> {
    const dir = path.resolve(__dirname, './data');

    this.config = convict(`${dir}/default.schema.json`);
    this.config.loadFile(`${dir}/default.config.json`);

    const env = `${dir}/${this.config.get('env')}.config.json`;

    if (this.logger) {
      this.logger.debug(`loading config for env '${this.config.get('env')}'`);
    }

    if (await util.promisify(fs.exists)(env)) {
      this.config.loadFile(env);
    }

    // @todo: determine based on config.provider where to load config from (e.g. dynamodb)
    // then simply merge the config via convict.config.load()
    // @todo: support multiple environments by storing envs and their config in a map

    await this.validate();
  }

  async set(key: string, value: any): Promise<void> {
    this.config.set(key, value);
  }

  async get(key?: string): Promise<any> {
    return this.config.get(key);
  }

  async has(key: string): Promise<boolean> {
    return this.config.has(key);
  }

  async validate(): Promise<any> {
    return this.config.validate({ allowed: 'warn' });
  }
}
