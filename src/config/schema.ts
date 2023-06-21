export default {
  env: {
    doc: 'The application environment.',
    format: ['production', 'development', 'test'],
    default: 'development',
    env: 'NODE_ENV',
  },
  hostname: {
    doc: 'Public hostname where the service is running on',
    default: 'localhost',
    env: 'PUBLIC_HOSTNAME',
  },
  port: {
    doc: 'The port to bind.',
    default: 3000,
  },
  api_prefix: {
    doc: 'The prefix for the API',
    default: '',
    env: 'API_PREFIX',
  },
  modules: {
    dispatcher: {
      doc: 'Configure which dispatcher modules should be enabled',
      default: 1,
      env: 'MODULES_DISPATCHER',
    },
    queuer: {
      doc: 'Configure which queuer modules should be enabled',
      default: 1,
      env: 'MODULES_QUEUER',
    },
  },
  rabbitmq: {
    client: {
      doc: 'The RabbitMQ client config. Uses default config if only protocol is given',
      default: 'amqp://',
      env: 'RABBITMQ_CLIENT',
    },
    api: {
      doc: 'RabbitMQ web api url. Management plugin must be installed. Uses rabbitmq hostname if omitted.',
      default: '',
      env: 'RABBITMQ_API',
    },
    queue: {
      doc: 'The default queue name used by rabbitmq',
      default: 'default',
      env: 'RABBITMQ_QUEUE',
    },
    exchange: {
      doc: 'The default exchange name used by rabbitmq. Note empty string has special meaning',
      default: "''",
      env: 'RABBITMQ_EXCHANGE',
    },
    shovel: {
      doc: 'The default shovel name used by rabbitmq',
      default: 'default',
      env: 'RABBITMQ_SHOVEL',
    },
  },
  log: {
    level: {
      default: 'info',
      env: 'LOG_LEVEL',
    },
    force: {
      default: false,
      env: 'LOG_FORCE',
    },
  },
};
