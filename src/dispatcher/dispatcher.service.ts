import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RabbitMQConnection } from '../rabbitmq/classes/rabbitmq.connection';
import { LoggerService } from '../common/logger/logger.service';
import { ConfigService } from '../common/config/config.service';
import { getNetwork, Message } from '@ltonetwork/lto';
import amqplib from 'amqplib';
import { RequestService } from '../common/request/request.service';
import { LtoIndexService } from '../common/lto-index/lto-index.service';

@Injectable()
export class DispatcherService implements OnModuleInit, OnModuleDestroy {
  private connection: RabbitMQConnection;

  constructor(
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
    private readonly rabbitMQ: RabbitMQService,
    private readonly request: RequestService,
    private readonly ltoIndex: LtoIndexService,
  ) {}

  async onModuleInit() {
    await this.start();
  }

  async onModuleDestroy() {
    await this.rabbitMQ.close();
  }

  async start(): Promise<void> {
    if (!this.config.isDispatcherEnabled()) {
      return this.logger.debug(`dispatcher: module not enabled`);
    }

    this.logger.debug(`dispatcher: starting connection`);
    this.connection = await this.rabbitMQ.connect(this.config.getRabbitMQClient());

    await this.connection.consume(
      this.config.getRabbitMQExchange(),
      this.config.getRabbitMQQueue(),
      this.onMessage.bind(this),
    );
  }

  async onMessage(msg: amqplib.Message): Promise<boolean> {
    const msgId = msg.properties.messageId;

    this.logger.debug(`dispatcher: message ${msgId} received`);

    if (!msg || !msg.content) {
      return this.deadletter(msg, `dispatcher: message ${msgId} deadlettered, it is invalid`);
    }

    let message: Message;

    try {
      const json = JSON.parse(msg.content.toString());
      message = Message.from(json);
    } catch (e) {
      return this.deadletter(msg, `message ${msgId} deadlettered, it is not valid json`);
    }

    if (!this.validateMessage(message, msg)) return;
    if (this.config.verifyAnchorOnDispatch() && !(await this.verifyAnchor(message, msg))) return;

    if (this.config.isStorageEnabled()) {
      // TODO Store the event
    }

    if (this.config.hasDispatchTarget()) {
      const target = this.config.getDispatchTarget();
      const response = await this.request.post(target, message);

      if (response.status === 400) {
        return this.deadletter(msg, `message ${msgId} deadlettered, ${target} returned 400`);
      }

      if (response.status > 299) {
        return this.retry(msg,`dispatcher: message ${msgId} requeued, ${target} returned ${response.status}`);
      }
    }

    this.connection.ack(msg);
    this.logger.info(`dispatcher: message ${msgId} acknowledged`);

    return true;
  }

  private validateMessage(message: Message, msg: amqplib.Message): boolean {
    const msgId = msg.properties.messageId;

    if (message.hash.base58 !== msgId) {
      return this.deadletter(msg, `message ${msgId} deadlettered, hash does not match message id`);
    }

    if (!message.verifyHash()) {
      return this.deadletter(msg, `message ${msgId} deadlettered, invalid hash`);
    }

    if (!this.config.isAcceptedAccount(message.recipient)) {
      return this.deadletter(msg, `message ${msgId} deadlettered, recipient is not accepted`);
    }

    if (!message.verifySignature()) {
      return this.deadletter(msg, `message ${msgId} deadlettered, invalid signature`);
    }

    return true;
  }

  private async verifyAnchor(message: Message, msg: amqplib.Message): Promise<boolean> {
    const msgId = msg.properties.messageId;
    const networkId = getNetwork(message.recipient);

    if (networkId !== 'L' && networkId !== 'T') {
      return this.deadletter(msg, `message ${msgId} deadlettered, unsupported network ${networkId}`);
    }

    if (!(await this.ltoIndex.verifyAnchor(networkId, msgId))) {
      return this.retry(msg, `message ${msgId} requeued, not anchored`);
    }
  }

  private deadletter(msg: amqplib.Message, reason: string): boolean {
    this.logger.warn(`dispatcher: ${reason}`);
    this.connection.deadletter(msg);

    return false;
  }

  private retry(msg: amqplib.Message, reason: string): boolean {
    this.logger.warn(`dispatcher: ${reason}`);
    this.connection.retry(msg);

    return false;
  }
}
