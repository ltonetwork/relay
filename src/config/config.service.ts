import { Injectable } from '@nestjs/common';
import { ConfigLoaderService } from './config-loader.service';
import { ConnectionString } from 'connection-string';
import toBoolean from 'boolean';

@Injectable()
export class ConfigService {
  constructor(private readonly config: ConfigLoaderService) { }

  hasModuleDispatcher(): boolean {
    const flag = this.config.get('dispatcher.modules.dispatcher');
    return toBoolean(flag);
  }

  hasModuleQueuer(): boolean {
    const flag = this.config.get('dispatcher.modules.queuer');
    return toBoolean(flag);
  }

  getEnv(): string {
    return this.config.get('env');
  }

  getHostname(): string {
    return this.config.get('hostname');
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
    return this.config.get('dispatcher.rabbitmq.client');
  }

  getRabbitMQClientAsObject(): {
    protocol, hostname, port, username, password, vhost,
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
    return (this.getRabbitMQClientAsObject()).vhost;
  }

  getRabbitMQApiUrl(): string {
    const config = this.config.get('dispatcher.rabbitmq.api');

    if (config) {
      return config;
    }

    const { hostname } = this.getRabbitMQClientAsObject();

    return `http://${hostname}:15672/api`;
  }

  getRabbitMQExchange(): string {
    return this.config.get('dispatcher.rabbitmq.exchange');
  }

  getRabbitMQQueue(): string {
    return this.config.get('dispatcher.rabbitmq.queue');
  }

  getRabbitMQShovel(): string {
    return this.config.get('dispatcher.rabbitmq.shovel');
  }

  getLegalEventsUrl(): string {
    return this.config.get('dispatcher.legalevents.url');
  }

  getLoggerConsole(): { level } {
    return this.config.get('dispatcher.logger.console');
  }

  getLoggerCombined(): { level } {
    return this.config.get('dispatcher.logger.combined');
  }
}
