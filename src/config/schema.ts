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
  accept: {
    accounts: {
      docs: 'List of account for which the service accepts messages',
      format: 'comma-separated-string',
      default: [],
      env: 'ACCEPT_ACCOUNTS',
    },
    all: {
      docs: 'Accept messages from all accounts',
      default: false,
      env: 'ACCEPT_ALL',
    }
  },
  dispatcher: {
    target: {
      doc: 'The target url for the dispatcher',
      default: '',
      env: 'DISPATCHER_TARGET',
    }
  },
  storage: {
    enabled: {
      doc: 'Enable storage module',
      default: true,
      env: 'STORAGE_ENABLED',
    },
    path: {
      doc: 'The path to the storage directory',
      default: './storage',
      env: 'STORAGE_PATH',
    }
  },
  queuer: {
    enabled: {
      doc: 'Enable queue module',
      default: true,
      env: 'QUEUER_ENABLED',
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
  did_resolver: {
    testnet: {
      doc: 'DID resolver for LTO node url',
      default: 'https://testnet.lto.network/index/identifiers',
      env: 'DID_RESOLVER_TESTNET',
    },
    mainnet: {
      doc: 'DID resolver for LTO node url',
      default: 'https://nodes.lto.network/index/identifiers',
      env: 'DID_RESOLVER_MAINNET',
    },
  },
  default_service_endpoint: {
    doc: 'The default service endpoint',
    default: 'amqp://relay.lto.network',
    env: 'DEFAULT_SERVICE_ENDPOINT',
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
