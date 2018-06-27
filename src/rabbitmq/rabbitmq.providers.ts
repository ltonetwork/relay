import amqplib from 'amqplib';
import { AMQPLIB } from '../constants';

export const rabbitmqProviders = [
  {
    provide: AMQPLIB,
    useValue: amqplib,
  },
];
