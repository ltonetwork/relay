import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RabbitMQConnection } from '../rabbitmq/classes/rabbitmq.connection';
import { LoggerService } from '../common/logger/logger.service';
import { ConfigService } from '../common/config/config.service';
import { Message } from '@ltonetwork/lto';
import amqplib from 'amqplib';
import { RequestService } from '../common/request/request.service';

@Injectable()
export class DispatcherService implements OnModuleInit, OnModuleDestroy {
  private connection: RabbitMQConnection;

  constructor(
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
    private readonly rabbitMQService: RabbitMQService,
    private readonly requestService: RequestService,
  ) {}

  async onModuleInit() {
    await this.start();
  }

  async onModuleDestroy() {
    await this.rabbitMQService.close();
  }

  async start(): Promise<void> {
    if (!this.config.isDispatcherEnabled()) {
      return this.logger.debug(`dispatcher: module not enabled`);
    }

    this.logger.debug(`dispatcher: starting connection`);
    this.connection = await this.rabbitMQService.connect(this.config.getRabbitMQClient());

    await this.connection.consume(
      this.config.getRabbitMQExchange(),
      this.config.getRabbitMQQueue(),
      this.onMessage.bind(this),
    );
  }

  async onMessage(msg: amqplib.Message) {
    this.logger.info(`dispatcher: message received`);

    if (!msg || !msg.content) {
      this.logger.warn(`dispatcher: message deadlettered, it is invalid`);
      return this.connection.deadletter(msg);
    }

    let message: Message;

    try {
      const json = JSON.parse(msg.content.toString());
      message = Message.from(json);
    } catch (e) {
      this.logger.warn(`dispatcher: message deadlettered, it is not valid json`);
      return this.connection.deadletter(msg);
    }

    if (!this.config.isAcceptedAccount(message.recipient)) {
      this.logger.warn(`dispatcher: message ${message.hash} deadlettered, recipient is not accepted`);
      return this.connection.deadletter(msg);
    }

    if (!message.verifySignature()) {
      this.logger.warn(`dispatcher: message ${message.hash} deadlettered, invalid signature`);
      return this.connection.deadletter(msg);
    }

    if (this.config.isStorageEnabled()) {
      // TODO Store the event
    }

    if (this.config.hasDispatchTarget()) {
      const target = this.config.getDispatchTarget();
      const response = await this.requestService.post(target, message);

      if (!response || response instanceof Error || !response.status || ![200, 201, 204].includes(response.status)) {
        this.logger.warn(`dispatcher: message ${message.hash} deadlettered, failed to send to ${target}`);
        return this.connection.deadletter(msg);
      }
    }

    this.connection.ack(msg);
    this.logger.info(`dispatcher: message ${message.hash} acknowledged`);
  }
}
