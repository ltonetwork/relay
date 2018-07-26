import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RabbitMQApiService } from '../rabbitmq/rabbitmq-api.service';
import { RabbitMQConnection } from '../rabbitmq/classes/rabbitmq.connection';
import { ConfigService } from '../config/config.service';
import util from 'util';

@Injectable()
export class QueuerService implements OnModuleInit, OnModuleDestroy {
  private connection: RabbitMQConnection;

  constructor(
    private readonly config: ConfigService,
    private readonly rabbitMQService: RabbitMQService,
    private readonly rabbitMQApiService: RabbitMQApiService,
  ) { }

  async onModuleInit() { }

  async onModuleDestroy() {
    await this.rabbitMQService.close();
  }

  async add(event: any, destination?: string | string[]): Promise<void> {
    if (!this.connection) {
      this.connection = await this.rabbitMQService.connect(await this.config.getRabbitMQClient());
    }

    if (!destination || !destination.length) {
      return this.addLocal(event);
    }

    const to = util.isString(destination) ? [destination] : destination;

    for (const node of to) {
      await this.addRemote(node, event);
    }
  }

  private async addLocal(event: any): Promise<void> {
    return await this.connection.publish(
      await this.config.getRabbitMQExchange(),
      await this.config.getRabbitMQQueue(),
      event,
    );
  }

  private async addRemote(node: string, event: any): Promise<void> {
    const response = await this.rabbitMQApiService.addDynamicShovel(node, node);

    if (
      !response || response instanceof Error || !response.status ||
      [200, 201, 204].indexOf(response.status) === - 1
    ) {
      // @todo: log error
      throw new Error('queuer: failed to add shovel for remote node');
    }

    return await this.connection.publish(
      await this.config.getRabbitMQExchange(),
      node,
      event,
    );
  }
}
