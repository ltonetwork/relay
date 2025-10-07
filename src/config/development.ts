export default {
  dev: {
    disable_auth: true,
    accept_unsigned: true,
    force_local_delivery: true,
  },
  dispatcher: {
    accept: {
      all: true,
    },
  },
  log: {
    level: 'debug',
  },
  default_service_endpoint: 'amqp://localhost:5672',
};
