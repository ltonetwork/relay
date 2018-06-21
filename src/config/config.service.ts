import { Injectable } from '@nestjs/common';
import { promisify } from 'util';
import { resolve } from 'path';
import { exists } from 'fs';
import * as convict from 'convict';
import convictFallback from 'convict';

@Injectable()
export class ConfigService {
  private config: convict.Config<object>;

  private getConvict() {
    // wtf
    return (typeof convict === 'function' && convict) || (typeof convictFallback === 'function' && convictFallback);
  }

  private async load(): Promise<void> {
    const dir = resolve(__dirname, './data');

    this.config = this.getConvict()(`${dir}/default.schema.json`);
    this.config.loadFile(`${dir}/default.config.json`);

    const env = `${dir}/default.${this.config.get('env')}.json`;
    if (await promisify(exists)(env)) {
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

    const config = this.config.get();
    const res = this.config.get(key);
    return res;
  }

  async has(key: string): Promise<boolean> {
    if (this.shouldReloadConfig()) {
      await this.load();
    }

    return this.config.has(key);
  }
}
