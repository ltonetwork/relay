import amqplib from 'amqplib';
import { ConfigService } from '../config/config.service';
import { RABBITMQ_CONNECTION, RABBITMQ_CHANNEL } from '../constants';

export const rabbitmqProviders = [
  {
    provide: RABBITMQ_CONNECTION,
    useFactory: async (configService: ConfigService) => {
        const config = await configService.get('rabbitmq');
        return await amqplib.connect(config);
    },
    inject: [ConfigService],
  },
  {
    provide: RABBITMQ_CHANNEL,
    useFactory: async (connection: amqplib.Connection) => {
      return await connection.createChannel();
    },
    inject: [RABBITMQ_CONNECTION],
  },
];
