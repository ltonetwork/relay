import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RabbitMQApiService } from '../rabbitmq/rabbitmq-api.service';
import { RabbitMQConnection } from '../rabbitmq/classes/rabbitmq.connection';
import { LoggerService } from '../logger/logger.service';
import { ConfigService } from '../config/config.service';
import { EventChain } from 'lto-api';
import util from 'util';

@Injectable()
export class QueuerService implements OnModuleInit, OnModuleDestroy {
  private connection: RabbitMQConnection;

  constructor(
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
    private readonly rabbitMQService: RabbitMQService,
    private readonly rabbitMQApiService: RabbitMQApiService,
  ) { }

  async onModuleInit() { }

  async onModuleDestroy() {
    await this.rabbitMQService.close();
  }

  async add(input: any, destination?: string | string[]): Promise<void> {
    if (!this.config.hasModuleQueuer()) {
      return this.logger.debug(`queuer: module not enabled`);
    }

    if (!this.connection) {
      this.connection = await this.rabbitMQService.connect(this.config.getRabbitMQClient());
    }

    const chain = (new EventChain()).setValues(input);
    const hash = chain.getLatestHash();

    chain.events = chain.events.map((event: any) => {
      event.origin = this.config.getRabbitMQPublicUrl();
      return event;
    });

    if (!destination || !destination.length) {
      this.logger.info(`queuer: adding chain '${chain.id}/${hash}' for local node`);
      return await this.addLocal(chain);
    }

    const to = util.isString(destination) ? [destination] : destination;

    for (const node of to) {
      this.logger.info(`queuer: adding chain '${chain.id}/${hash}' for remote node '${node}'`);
      await this.addRemote(node, chain);
    }
  }

  private async addLocal(chain: any): Promise<void> {
    return await this.connection.publish(
      this.config.getRabbitMQExchange(),
      this.config.getRabbitMQQueue(),
      chain,
    );
  }

  private async addRemote(node: string, chain: any): Promise<void> {
    // explicitly init queue before shovel creates it
    await this.connection.init(this.config.getRabbitMQExchange(), node, node);

    const response = await this.rabbitMQApiService.addDynamicShovel(node, node);

    if (
      !response || response instanceof Error || !response.status ||
      [200, 201, 204].indexOf(response.status) === - 1
    ) {
      throw new Error('queuer: failed to add shovel for remote node');
    }

    return await this.connection.publish(
      this.config.getRabbitMQExchange(),
      node,
      chain,
    );
  }
}
