import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RabbitMQConnection } from '../rabbitmq/classes/rabbitmq.connection';
import { LoggerService } from '../common/logger/logger.service';
import { ConfigService } from '../common/config/config.service';
import { buildAddress, getNetwork, Message } from '@ltonetwork/lto';
import amqplib from 'amqplib';
import { RequestService } from '../common/request/request.service';
import { LtoIndexService } from '../common/lto-index/lto-index.service';
import { APP_ID } from '../constants';

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
    if (!msg.content || !msg.properties.messageId) {
      return this.deadletter(msg, `message deadlettered, it is invalid`);
    }

    const msgId = msg.properties.messageId;
    this.logger.debug(`dispatcher: message ${msgId} received`);

    const message = this.decodeMessage(msg);

    if (!this.validateMessage(message, msg)) return;
    if (this.config.verifyAnchorOnDispatch() && !(await this.verifyAnchor(message, msg))) return;

    if (this.config.isStorageEnabled()) {
      // TODO Store the event
    }

    if (!(await this.dispatch(message, msg))) return;

    this.connection.ack(msg);
    this.logger.info(`dispatcher: message ${msgId} acknowledged`);

    return true;
  }

  private decodeMessage(msg: amqplib.Message): Message | undefined {
    switch (msg.properties.contentType) {
      case 'application/json':
        const json = JSON.parse(msg.content.toString());
        return Message.from(json);
      case 'application/octet-stream':
        return Message.from(msg.content);
      default:
        this.deadletter(msg, `message ${msg.properties.messageId} deadlettered, content type is not supported`);
    }
  }

  private validateMessage(message: Message, msg: amqplib.Message): boolean {
    const msgId = msg.properties.messageId;

    if (msg.properties.appId !== APP_ID) {
      return this.deadletter(msg, `message ${msgId} deadlettered, invalid app id`);
    }

    if (message.type !== msg.properties.type) {
      return this.deadletter(msg, `message ${msgId} deadlettered, type does not match message type`);
    }

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

  private async dispatch(message: Message, msg: amqplib.Message): Promise<boolean> {
    const target = this.config.getDispatchTarget();
    if (!target) return true;

    const msgId = msg.properties.messageId;
    const networkId = getNetwork(message.recipient);

    const data = message.isEncrypted() ? message.encryptedData : message.data;
    const headers: Record<string, string> = {
      'Content-Type': message.isEncrypted() ? 'application/octet-stream' : message.mediaType,
      'LTO-Message-Type': message.type,
      'LTO-Message-Sender': buildAddress(message.sender.publicKey, networkId),
      'LTO-Message-SenderKeyType': message.sender.keyType,
      'LTO-Message-SenderPublicKey': message.sender.publicKey.base58,
      'LTO-Message-Recipient': message.recipient,
      'LTO-Message-Signature': message.signature.base58,
      'LTO-Message-Timestamp': message.timestamp.toString(),
      'LTO-Message-Hash': message.hash.base58,
    };

    const response = await this.request.post(target, data, { headers });

    if (response.status === 400) {
      return this.deadletter(msg, `message ${msgId} deadlettered, ${target} returned 400`);
    }

    if (response.status > 299) {
      return this.retry(msg,`message ${msgId} requeued, ${target} returned ${response.status}`);
    }

    return true;
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
