import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RabbitMQConnection } from '../rabbitmq/classes/rabbitmq.connection';
import { LoggerService } from '../common/logger/logger.service';
import { ConfigService } from '../common/config/config.service';
import { Message } from 'eqty-core';
import { getNetworkId } from '../common/address/address.utils';
import { BaseAnchorService } from '../common/blockchain/base-anchor.service';
import amqplib from 'amqplib';
import { RequestService } from '../common/request/request.service';
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
    private readonly baseAnchor: BaseAnchorService,
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

    if (!(await this.validateMessage(message, msg))) return false;

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

  private async validateMessage(message: Message, msg: amqplib.Message): Promise<boolean> {
    const msgId = msg.properties.messageId;

    if (msg.properties.appId !== APP_ID) {
      return this.reject(msg, `message ${msgId} rejected, invalid app id`);
    }

    if (message.meta?.type !== msg.properties.type) {
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

    if (message.isSigned() && !(await message.verifySignature(async () => true))) {
      return this.reject(msg, `message ${msgId} rejected, invalid signature`);
    }

    return true;
  }

  private async verifyAnchor(message: Message, msg: amqplib.Message): Promise<boolean> {
    const msgId = msg.properties.messageId;
    const networkId = getNetworkId(message.recipient);

    if (!this.baseAnchor.isNetworkSupported(networkId)) {
      return this.reject(msg, `message ${msgId} rejected, unsupported network ${networkId}`);
    }

    const result = await this.baseAnchor.verifyAnchor(networkId, message.hash);
    if (!result.isAnchored) {
      return this.retry(msg, `message ${msgId} requeued, not anchored: ${result.error}`);
    }

    return true;
  }

  private async dispatch(message: Message, msg: amqplib.Message): Promise<boolean> {
    const target = this.config.getDispatchTarget();
    if (!target.url) return true;

    const msgId = msg.properties.messageId;
    const _networkId = getNetworkId(message.recipient);

    const data = message.data;
    const headers: Record<string, string> = {
      'Content-Type': message.mediaType,
      'EQTY-Message-Type': message.meta?.type || 'basic',
      'EQTY-Message-Sender': message.sender || '',
      'EQTY-Message-Recipient': message.recipient,
      'EQTY-Message-Signature': message.signature?.base58 || '',
      'EQTY-Message-Timestamp': message.timestamp?.toString() || '',
      'EQTY-Message-Hash': message.hash.base58,
    };

    if (target.api_key) {
      headers['Authorization'] = `Bearer ${target.api_key}`;
    }

    const response = await this.request.post(target.url, data, { headers });

    if (response.status === 400) {
      return this.reject(msg, `message ${msgId} rejected, POST ${target.url} gave a 400 response`);
    }

    if (response.status > 299) {
      return this.retry(msg, `message ${msgId} requeued, POST ${target.url} gave a ${response.status} response`);
    }

    this.logger.debug(`dispatcher: message ${msgId} dispatched to ${target.url}`);

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
