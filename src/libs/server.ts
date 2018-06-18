// modules
import * as express from 'express';
import * as config from 'config';

class Server {
  config: config.IConfig;
  app: express.Express;

  constructor (config: config.IConfig, app: express.Express) {
    this.config = config;
    this.app = app;
  }

  async start (): Promise<any> {
    return new Promise(async (resolve: any, reject: any) => {
      this.app.listen(config.get('port'), () => resolve());
    });
  }
}

export { Server };
