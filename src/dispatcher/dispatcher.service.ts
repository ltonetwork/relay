import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RabbitMQConnection } from '../rabbitmq/classes/rabbitmq.connection';
import { LoggerService } from '../common/logger/logger.service';
import { ConfigService } from '../common/config/config.service';
import { buildAddress, getNetwork } from '@ltonetwork/lto/utils';
import { Message } from '@ltonetwork/lto/messages';
import amqplib from 'amqplib';
import { RequestService } from '../common/request/request.service';
import { LtoIndexService } from '../common/lto-index/lto-index.service';
import { APP_ID } from '../constants';
import { InboxService } from '../inbox/inbox.service';

@Injectable()
export class DispatcherService implements OnModuleInit, OnModuleDestroy {
  private connection: RabbitMQConnection;

  constructor(
    private readonly config: ConfigService,
    private readonly rabbitMQ: RabbitMQService,
    private readonly request: RequestService,
    private readonly inbox: InboxService,
    private readonly ltoIndex: LtoIndexService,
    private readonly logger: LoggerService,
  ) {}

  async onModuleInit() {
    await this.start();
  }

  async onModuleDestroy() {
    await this.rabbitMQ.close();
  }

  private async start(): Promise<void> {
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
    if (!msg.properties.messageId) {
      return this.reject(msg, `message rejected, no message id`);
    }

    const msgId = msg.properties.messageId;
    this.logger.debug(`dispatcher: message ${msgId} received`);

    const message = this.decodeMessage(msg);
    if (!message) return false;

    if (!this.validateMessage(message, msg)) return false;

    if (this.config.verifyAnchorOnDispatch()) {
      const verified = await this.verifyAnchor(message, msg);
      if (!verified) return false;
    }

    if (this.config.isInboxEnabled()) {
      await this.inbox.store(message);
    }

    if (!(await this.dispatch(message, msg))) return false;

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
        this.reject(msg, `message ${msg.properties.messageId} rejected, content type is not supported`);
    }
  }

  private validateMessage(message: Message, msg: amqplib.Message): boolean {
    const msgId = msg.properties.messageId;

    if (msg.properties.appId !== APP_ID) {
      return this.reject(msg, `message ${msgId} rejected, invalid app id`);
    }

    if (message.type !== msg.properties.type) {
      return this.reject(msg, `message ${msgId} rejected, type does not match message type`);
    }

    if (message.hash.base58 !== msgId) {
      return this.reject(msg, `message ${msgId} rejected, hash does not match message id`);
    }

    if (!message.verifyHash()) {
      return this.reject(msg, `message ${msgId} rejected, invalid hash`);
    }

    if (!this.config.isAcceptedAccount(message.recipient)) {
      return this.reject(msg, `message ${msgId} rejected, recipient is not accepted`);
    }

    if (!this.config.acceptUnsigned() && !message.isSigned()) {
      return this.reject(msg, `message ${msgId} rejected, message is not signed`);
    }

    if (message.isSigned() && !message.verifySignature()) {
      return this.reject(msg, `message ${msgId} rejected, invalid signature`);
    }

    return true;
  }

  private async verifyAnchor(message: Message, msg: amqplib.Message): Promise<boolean> {
    const msgId = msg.properties.messageId;
    const networkId = getNetwork(message.recipient);

    if (networkId !== 'L' && networkId !== 'T') {
      return this.reject(msg, `message ${msgId} rejected, unsupported network ${networkId}`);
    }

    if (!(await this.ltoIndex.verifyAnchor(networkId, message.hash))) {
      return this.retry(msg, `message ${msgId} requeued, not anchored`);
    }

    return true;
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
      return this.reject(msg, `message ${msgId} rejected, POST ${target} gave a 400 response`);
    }

    if (response.status > 299) {
      return this.retry(msg, `message ${msgId} requeued, POST ${target} gave a ${response.status} response`);
    }

    this.logger.debug(`dispatcher: message ${msgId} dispatched to ${target}`);

    return true;
  }

  private reject(msg: amqplib.Message, reason: string): boolean {
    this.logger.warn(`dispatcher: ${reason}`);
    this.connection.reject(msg);

    return false;
  }

  private retry(msg: amqplib.Message, reason: string): boolean {
    this.logger.warn(`dispatcher: ${reason}`);
    this.connection.retry(msg);

    return false;
  }
}
