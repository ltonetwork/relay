import { Injectable } from '@nestjs/common';
import { ConfigLoaderService } from './config-loader.service';
import { ConnectionString } from 'connection-string';
import { camelCase } from '../../utils/transform-case';

@Injectable()
export class ConfigService {
  public readonly app: { name: string; description: string; version: string };

  constructor(private readonly config: ConfigLoaderService) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { name, description, version } = require('../../../package.json');
    this.app = { name: camelCase(name), description, version };
  }

  isDispatcherEnabled(): boolean {
    return !!this.config.get('dispatcher.target') || this.config.get('inbox.enabled');
  }

  isInboxEnabled(): boolean {
    return this.config.get('inbox.enabled');
  }

  isQueuerEnabled(): boolean {
    return this.config.get('queuer.enabled');
  }

  getDispatchTarget(): string {
    return this.config.get('dispatcher.target');
  }

  getStoragePath(): string {
    return this.config.get('inbox.storage');
  }

  getStorageEmbedMaxSize(): number {
    return this.config.get('inbox.embed_max_size');
  }

  verifyAnchorOnDispatch(): boolean {
    return this.config.get('dispatcher.verify_anchor');
  }

  isAcceptedAccount(account: string): boolean {
    return this.config.get('dispatcher.accept.all') || this.config.get('dispatcher.accept.accounts').includes(account);
  }

  getEnv(): string {
    return this.config.get('env');
  }

  isEnv(env: string): boolean {
    return this.getEnv() === env || this.getEnv().startsWith(`${env}.`);
  }

  getHostname(): string {
    return this.config.get('hostname');
  }

  getPort(): number {
    return this.config.get('port');
  }

  getApiPrefix(): string {
    return this.config.get('api_prefix');
  }

  getRedisUrl(): string {
    return this.config.get('redis.url');
  }

  getRabbitMQPublicUrl(): string {
    const hostname = this.getHostname();
    const string = this.getRabbitMQClient();
    const parsed = new ConnectionString(string);
    parsed.hosts = parsed.hosts || [{}];

    if (!parsed.hosts[0].name || ['rabbitmq', 'localhost'].indexOf(parsed.hosts[0].name) > -1) {
      parsed.hosts[0].name = hostname;

      parsed.hosts[0].port = (parsed.hosts && parsed.hosts[0].port) || 5672;
      parsed.user = parsed.user || 'guest';
      parsed.password = parsed.password || 'guest';
    }

    return parsed.toString();
  }

  getRabbitMQClient(): string {
    return this.config.get('rabbitmq.client');
  }

  getRabbitMQClientAsObject(): {
    protocol;
    hostname;
    port;
    username;
    password;
    vhost;
  } {
    const string = this.getRabbitMQClient();
    const parsed = new ConnectionString(string);

    return {
      protocol: parsed.protocol || 'amqp',
      hostname: (parsed.hosts && parsed.hosts[0].name) || 'localhost',
      port: (parsed.hosts && parsed.hosts[0].port) || 5672,
      username: parsed.user || 'guest',
      password: parsed.password || 'guest',
      vhost: (parsed.path && parsed.path[0]) || '/',
    };
  }

  getRabbitMQCredentials(): { username; password } {
    const { username, password } = this.getRabbitMQClientAsObject();
    return { username, password };
  }

  getRabbitMQVhost(): string {
    return this.getRabbitMQClientAsObject().vhost;
  }

  getRabbitMQApiUrl(): string {
    const config = this.config.get('rabbitmq.api');

    if (config) {
      return config;
    }

    const { hostname } = this.getRabbitMQClientAsObject();

    return `http://${hostname}:15672/api`;
  }

  getRabbitMQExchange(): string {
    return this.config.get('rabbitmq.exchange');
  }

  getRabbitMQQueue(): string {
    return this.config.get('rabbitmq.queue');
  }

  getRabbitMQShovel(): string {
    return this.config.get('rabbitmq.shovel');
  }

  private networkName(network: 'mainnet' | 'testnet' | 'L' | 'T'): 'mainnet' | 'testnet' {
    if (network === 'L') return 'mainnet';
    if (network === 'T') return 'testnet';
    return network;
  }

  getLTONode(network: 'mainnet' | 'testnet' | 'L' | 'T'): string {
    return this.config.get(`lto.${this.networkName(network)}.node`);
  }

  getDidResolver(network: 'mainnet' | 'testnet' | 'L' | 'T'): string {
    return this.config.get(`lto.${this.networkName(network)}.did_resolver`);
  }

  getDefaultServiceEndpoint(): string {
    return this.config.get('default_service_endpoint');
  }

  getLog(): { level: string; force: boolean } {
    return this.config.get('log');
  }
}
