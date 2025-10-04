import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import convict from 'convict';
import { configurations, schema } from '../../config';

type SchemaOf<T extends convict.Schema<any>> = T extends convict.Schema<infer R> ? R : any;
type Schema = SchemaOf<typeof schema>;
type Path = convict.Path<SchemaOf<typeof schema>>;
type PathValue<K extends Path> = K extends null | undefined
  ? Schema
  : K extends convict.Path<Schema>
  ? convict.PathValue<Schema, K>
  : never;

@Injectable()
export class ConfigLoaderService implements OnModuleInit, OnModuleDestroy {
  private config: convict.Config<Schema>;
  private readonly ttl: number = 300000; // 5 minutes in milliseconds
  private configReloadInterval: ReturnType<typeof setInterval>;

  constructor() {
    // ConfigLoaderService constructor
  }

  async onModuleInit() {
    if (!this.config) {
      await this.load();
    }

    this.configReloadInterval ??= setInterval(async () => {
      await this.load();
    }, this.ttl);
  }

  async onModuleDestroy() {
    if (this.configReloadInterval) {
      clearInterval(this.configReloadInterval);
    }
  }

  public async load(): Promise<void> {
    const config = convict(schema);
    const key = config.get('env');

    if (key in configurations) {
      config.load(configurations[key]);
    }

    await config.validate({ allowed: 'warn' });

    this.config = config;
  }

  set<K extends Path>(key: K, value: any): void {
    this.config.set(key, value);
  }

  get<K extends Path>(key?: K): PathValue<K> {
    return this.config.get(key);
  }

  has(key: Path): boolean {
    return this.config.has(key);
  }
}
