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
};
