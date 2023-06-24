import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RabbitMQApiService } from '../rabbitmq/rabbitmq-api.service';
import { RabbitMQConnection } from '../rabbitmq/classes/rabbitmq.connection';
import { LoggerService } from '../common/logger/logger.service';
import { ConfigService } from '../common/config/config.service';
import { Message } from '@ltonetwork/lto';
import { DidResolverService } from '../common/did-resolver/did-resolver.service';

@Injectable()
export class QueuerService implements OnModuleInit {
  private connection: RabbitMQConnection;

  constructor(
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
    private readonly resolver: DidResolverService,
    private readonly rabbitMQService: RabbitMQService,
    private readonly rabbitMQApiService: RabbitMQApiService,
  ) {}

  async onModuleInit() {
    if (!this.config.isQueuerEnabled()) return;
    this.connection = await this.rabbitMQService.connect(this.config.getRabbitMQClient());
  }

  isEnabled(): boolean {
    return this.config.isQueuerEnabled();
  }

  private isLocalEndpoint(endpoint: string): boolean {
    return new URL(endpoint).hostname === this.config.getHostname();
  }

  async send(message: Message): Promise<void> {
    if (!this.isEnabled()) throw new Error(`queuer: module not enabled`);

    const endpoint = await this.resolver.getServiceEndpoint(message.recipient);

    if (this.isLocalEndpoint(endpoint)) {
      await this.addLocal(message);
    } else {
      await this.addRemote(endpoint, message);
    }
  }

  private async addLocal(message: Message): Promise<void> {
    this.logger.info(`queuer: delivering message '${message.hash}'`);
    return await this.connection.publish(this.config.getRabbitMQExchange(), this.config.getRabbitMQQueue(), message);
  }

  private async addRemote(endpoint: string, message: Message): Promise<void> {
    // explicitly init queue before shovel creates it
    await this.connection.init(this.config.getRabbitMQExchange(), endpoint, endpoint);

    const response = await this.rabbitMQApiService.addDynamicShovel(endpoint, endpoint);

    if (!response || response instanceof Error || !response.status || ![200, 201, 204].includes(response.status)) {
      throw new Error('queuer: failed to add shovel for remote endpoint');
    }

    this.logger.info(`queuer: delivering message '${message.hash}' to '${endpoint}'`);
    return await this.connection.publish(this.config.getRabbitMQExchange(), endpoint, message);
  }
}
