import { Injectable } from '@nestjs/common';
import { ConfigLoaderService } from './config-loader.service';

@Injectable()
export class ConfigService {
  constructor(private readonly config: ConfigLoaderService) { }

  async getEnv(): Promise<string> {
    return await this.config.get('env');
  }

  async getRabbitMQClient(): Promise<object> {
    return await this.config.get('dispatcher.rabbitmq.client');
  }

  async getRabbitMQCredentials(): Promise<{ username, password }> {
    return {
      username: await this.config.get('dispatcher.rabbitmq.client.username'),
      password: await this.config.get('dispatcher.rabbitmq.client.password'),
    };
  }

  async getRabbitMQVhost(): Promise<string> {
    return await this.config.get('dispatcher.rabbitmq.client.vhost');
  }

  async getRabbitMQApiUrl(): Promise<string> {
    return await this.config.get('dispatcher.rabbitmq.api');
  }

  async getRabbitMQQueue(): Promise<string> {
    return await this.config.get('dispatcher.rabbitmq.queue');
  }

  async getLegalEventsUrl(): Promise<string> {
    return await this.config.get('dispatcher.legalevents.url');
  }
}
