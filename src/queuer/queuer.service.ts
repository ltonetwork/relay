import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RabbitMQApiService } from '../rabbitmq/rabbitmq-api.service';
import { RabbitMQConnection } from '../rabbitmq/classes/rabbitmq.connection';
import { LoggerService } from '../common/logger/logger.service';
import { ConfigService } from '../common/config/config.service';
import { Message } from '@ltonetwork/lto';
import { DidResolverService } from '../common/did-resolver/did-resolver.service';
import { APP_ID } from '../constants';
import { ApiTags } from '@nestjs/swagger';

@Injectable()
export class QueuerService implements OnModuleInit {
  private connection: RabbitMQConnection;

  constructor(
    private readonly config: ConfigService,
    private readonly resolver: DidResolverService,
    private readonly rabbitMQService: RabbitMQService,
    private readonly rabbitMQApiService: RabbitMQApiService,
    private readonly logger: LoggerService,
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

  async add(message: Message): Promise<void> {
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
    await this.publish(this.config.getRabbitMQQueue(), message);
  }

  private async addRemote(endpoint: string, message: Message): Promise<void> {
    const queueInfo = await this.connection.checkQueue(endpoint);
    if (!queueInfo) await this.createShovel(endpoint);

    this.logger.info(`queuer: delivering message '${message.hash}' to '${endpoint}'`);
    await this.publish(endpoint, message);
  }

  private async createShovel(endpoint: string): Promise<void> {
    // explicitly init queue before shovel creates it
    await this.connection.init(this.config.getRabbitMQExchange(), endpoint, endpoint);

    const response = await this.rabbitMQApiService.addDynamicShovel(endpoint, endpoint);

    if (response.status > 299) {
      throw new Error('queuer: failed to add shovel for remote endpoint');
    }
  }

  private async publish(endpoint: string, message: Message): Promise<void> {
    await this.connection.publish(
      this.config.getRabbitMQExchange(),
      endpoint,
      message.toBinary(),
      {
        appId: APP_ID,
        messageId: message.hash.base58,
        type: message.type,
      }
    );
  }
}
