import { Injectable } from '@nestjs/common';
import util from 'util';
import path from 'path';
import fs from 'fs';
import convict from 'convict';

@Injectable()
export class ConfigService {
  private config: convict.Config<object>;

  private async load(): Promise<void> {
    const dir = path.resolve(__dirname, './data');

    this.config = convict(`${dir}/default.schema.json`);
    this.config.loadFile(`${dir}/default.config.json`);

    const env = `${dir}/default.${this.config.get('env')}.json`;
    if (await util.promisify(fs.exists)(env)) {
      this.config.loadFile(env);
    }

    // @todo: determine based on config.provider where to load config from (e.g. dynamodb)
    // then simply merge the config via convict.config.load()
  }

  private shouldReloadConfig(): boolean {
    // @todo: add cache and if its ttl expires we should reload aswell
    return !this.config;
  }

  async set(key: string, value: any): Promise<void> {
    if (this.shouldReloadConfig()) {
      await this.load();
    }

    this.config.set(key, value);
  }

  async get(key?: string): Promise<any> {
    if (this.shouldReloadConfig()) {
      await this.load();
    }

    return this.config.get(key);
  }

  async has(key: string): Promise<boolean> {
    if (this.shouldReloadConfig()) {
      await this.load();
    }

    return this.config.has(key);
  }
}
