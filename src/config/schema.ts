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
    env: 'PORT',
  },
  api_prefix: {
    doc: 'The prefix for the API',
    default: '',
    env: 'API_PREFIX',
  },
  dev: {
    disable_auth: {
      doc: 'Disable authentication in development mode',
      default: false,
      env: 'DISABLE_AUTH',
    },
    accept_unsigned: {
      doc: 'Accept unsigned messages in development mode',
      default: false,
      env: 'ACCEPT_UNSIGNED',
    },
    force_local_delivery: {
      doc: 'Force local delivery in development mode',
      default: false,
      env: 'FORCE_LOCAL_DELIVERY',
    },
  },
  redis: {
    url: {
      doc: 'The Redis DSN',
      default: 'redis://localhost:6379',
      env: 'REDIS_URL',
    },
  },
  dispatcher: {
    target: {
      url: {
        doc: 'The target url for the dispatcher',
        default: '',
        env: 'DISPATCH_TARGET_URL',
      },
      api_key: {
        doc: 'The API key for bearer auth for the dispatch target',
        default: '',
        env: 'DISPATCH_TARGET_API_KEY',
      },
    },
    verify_anchor: {
      doc: 'Verify anchor before dispatching',
      default: false,
      env: 'VERIFY_ANCHOR',
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
      },
    },
  },
  inbox: {
    enabled: {
      doc: 'Enable inbox module',
      default: true,
      env: 'INBOX_ENABLED',
    },
    storage: {
      doc: 'Path or bucket DSN for the inbox storage',
      default: './storage',
      env: 'INBOX_STORAGE',
    },
    embed_max_size: {
      doc: 'The maximum size for which the message content is embedded in the index',
      default: 1024,
      env: 'INBOX_EMBED_MAX_SIZE',
    },
  },
  queue: {
    enabled: {
      doc: 'Enable queue module',
      default: true,
      env: 'QUEUE_ENABLED',
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
      doc: 'The default exchange name used by rabbitmq',
      default: 'amq.direct',
      env: 'RABBITMQ_EXCHANGE',
    },
    shovel: {
      doc: 'The default shovel name used by rabbitmq',
      default: 'default',
      env: 'RABBITMQ_SHOVEL',
    },
    public_url: {
      doc: 'The public url of the rabbitmq server. Uses the client url if omitted.',
      default: '',
      env: 'RABBITMQ_PUBLIC_URL',
    },
  },
  blockchain: {
    base: {
      mainnet: {
        rpc_url: {
          doc: 'Base mainnet RPC URL',
          default: 'https://mainnet.base.org',
          env: 'BASE_MAINNET_RPC_URL',
        },
        anchor_contract: {
          doc: 'Base mainnet anchor contract address',
          default: '0x0000000000000000000000000000000000000000', // Will be set by eqty-core
          env: 'BASE_MAINNET_ANCHOR_CONTRACT',
        },
      },
      sepolia: {
        rpc_url: {
          doc: 'Base Sepolia testnet RPC URL',
          default: 'https://sepolia.base.org',
          env: 'BASE_SEPOLIA_RPC_URL',
        },
        anchor_contract: {
          doc: 'Base Sepolia anchor contract address',
          default: '0x0000000000000000000000000000000000000000', // Will be set by eqty-core
          env: 'BASE_SEPOLIA_ANCHOR_CONTRACT',
        },
      },
    },
    anchor_verification: {
      cache_ttl: {
        doc: 'Cache TTL for anchor verification results in milliseconds',
        default: 300000, // 5 minutes
        env: 'ANCHOR_VERIFICATION_CACHE_TTL',
      },
      max_retries: {
        doc: 'Maximum number of retries for blockchain queries',
        default: 3,
        env: 'ANCHOR_VERIFICATION_MAX_RETRIES',
      },
      timeout: {
        doc: 'Timeout for blockchain queries in milliseconds',
        default: 10000, // 10 seconds
        env: 'ANCHOR_VERIFICATION_TIMEOUT',
      },
      use_redis_cache: {
        doc: 'Use Redis for anchor verification caching instead of in-memory',
        default: false,
        env: 'ANCHOR_VERIFICATION_USE_REDIS_CACHE',
      },
    },
  },
  lto: {
    testnet: {
      node: {
        doc: 'LTO testnet node url',
        default: 'https://testnet.lto.network',
        env: 'LTO_NODE_TESTNET',
      },
      did_resolver: {
        doc: 'DID resolver for LTO node url',
        default: 'https://testnet.lto.network/index/identifiers',
        env: 'DID_RESOLVER_TESTNET',
      },
    },
    mainnet: {
      node: {
        doc: 'LTO mainnet node url',
        default: 'https://nodes.lto.network',
        env: 'LTO_NODE_MAINNET',
      },
      did_resolver: {
        doc: 'DID resolver for LTO node url',
        default: 'https://nodes.lto.network/index/identifiers',
        env: 'DID_RESOLVER_MAINNET',
      },
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
