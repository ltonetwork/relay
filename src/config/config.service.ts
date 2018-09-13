import { Injectable } from '@nestjs/common';
import { ConfigLoaderService } from './config-loader.service';
import { ConnectionString } from 'connection-string';
import toBoolean from 'boolean';

@Injectable()
export class ConfigService {
  constructor(private readonly config: ConfigLoaderService) { }

  async hasModuleDispatcher(): Promise<boolean> {
    const flag = await this.config.get('dispatcher.modules.dispatcher');
    return toBoolean(flag);
  }

  async hasModuleQueuer(): Promise<boolean> {
    const flag = await this.config.get('dispatcher.modules.queuer');
    return toBoolean(flag);
  }

  async getEnv(): Promise<string> {
    return await this.config.get('env');
  }

  async getRabbitMQClient(): Promise<string> {
    return await this.config.get('dispatcher.rabbitmq.client');
  }

  async getRabbitMQClientAsObject(): Promise<{
    protocol, hostname, port, username, password, vhost,
  }> {
    const string = await this.getRabbitMQClient();
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

  async getRabbitMQCredentials(): Promise<{ username; password }> {
    const { username, password } = await this.getRabbitMQClientAsObject();
    return { username, password };
  }

  async getRabbitMQVhost(): Promise<string> {
    return (await this.getRabbitMQClientAsObject()).vhost;
  }

  async getRabbitMQApiUrl(): Promise<string> {
    const config = await this.config.get('dispatcher.rabbitmq.api');

    if (config) {
      return config;
    }

    const { hostname } = await this.getRabbitMQClientAsObject();

    return `http://${hostname}:15672/api`;
  }

  async getRabbitMQExchange(): Promise<string> {
    return await this.config.get('dispatcher.rabbitmq.exchange');
  }

  async getRabbitMQQueue(): Promise<string> {
    return await this.config.get('dispatcher.rabbitmq.queue');
  }

  async getRabbitMQShovel(): Promise<string> {
    return await this.config.get('dispatcher.rabbitmq.shovel');
  }

  async getLegalEventsUrl(): Promise<string> {
    return await this.config.get('dispatcher.legalevents.url');
  }

  async getLoggerConsole(): Promise<{ level }> {
    return await this.config.get('dispatcher.logger.console');
  }

  async getLoggerCombined(): Promise<{ level }> {
    return await this.config.get('dispatcher.logger.combined');
  }
}
