export default {
  dev: {
    disable_auth: false,
    accept_unsigned: false,
    force_local_delivery: false,
  },
  inbox: {
    enabled: true,
    storage: './storage',
    embed_max_size: 1024 * 1024,
  },
  queue: {
    enabled: true,
  },
  rabbitmq: {
    client: 'amqp://guest:guest@localhost:5672',
    exchange: 'eqty-relay',
    queue: 'eqty-relay-queue',
    api: 'http://localhost:15672/api',
  },
  dispatcher: {
    verify_anchor: true,
    accept: {
      all: true,
    },
  },
  log: {
    level: 'debug',
  },
  default_service_endpoint: 'amqp://localhost:5672',
  default_network_id: 84532, // Base Sepolia for development
  blockchain: {
    base: {
      sepolia: {
        rpc_url: 'https://base-sepolia.public.blastapi.io',
      },
    },
    anchor_verification: {
      cache_ttl: 300000,
      max_retries: 10,
      timeout: 20000,
      use_redis_cache: true,
    },
  },
};
