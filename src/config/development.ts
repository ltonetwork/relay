export default {
  dev: {
    disable_auth: true,
    accept_unsigned: true,
    force_local_delivery: true,
  },
  dispatcher: {
    verify_anchor: false,
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
