import fs from 'fs';

import SteamPICS from './handlers/pics';
import SteamUser from './steam-user';
import logger from '../logger';
import env from '../env';

const NodeSteam = require('steam');

class Steam {
  private client: any;

  private pics: SteamPICS;

  private user: SteamUser;

  constructor() {
    this.client = new NodeSteam.SteamClient();
    this.pics = new SteamPICS(this.client);
    this.user = new SteamUser(this.client);
  }

  async getAppInfoAsync(appid: number) {
    return new Promise((resolve) => {
      this.pics.getProductInfo([{ appid, only_public: true }], (result: any) => {
        resolve(result.apps[0] || undefined);
      });
    });
  }

  init() {
    if (fs.existsSync('servers.json')) {
      NodeSteam.servers = JSON.parse(fs.readFileSync('servers.json').toString());
    }

    this.client.on('connected', () => {
      logger.debug('Connected to Steam');
      this.user.logOnAnon();
    });

    if (env.debug) {
      this.client.on('debug', (msg: string) => {
        logger.debug(msg);
      });
    }

    this.client.on('error', (err: Error) => {
      logger.error(err);
    });

    this.client.on('logOnResponse', (res: any) => {
      if (res.eresult !== NodeSteam.EResult.OK) {
        logger.error('Steam login failed');
        return;
      }

      logger.debug('Logged in to Steam');
    });

    this.client.on('servers', (servers: object) => {
      fs.writeFileSync('servers.json', JSON.stringify(servers));
    });

    this.client.connect();
  }

  quit() {
    this.client.disconnect();
  }
}

export default new Steam();
