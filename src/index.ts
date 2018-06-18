// env vars
process.env.NODE_ENV = process.env.NODE_ENV || 'dev';
process.env.NODE_CONFIG_DIR = process.cwd() + '/src/config';

// imports
import * as config from 'config';
import { Server } from './libs/server';
import { app } from './libs/app';

// start server
(async () => {
  const server = new Server(config, app);
  await server.start();

  console.log(('App is running at http://localhost:%d in %s mode'), config.get('port'), config.get('env'));
  console.log('Press CTRL-C to stop\n');
})();
