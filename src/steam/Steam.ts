import fs from 'fs';

import SteamPICS from './handlers/PICS';
import SteamUser from './SteamUser';
import logger from '../logger';
import env from '../env';

const NodeSteam = require('steam');

// Irrelevant properties omitted
interface AppInfo {
  appid: number;
  // eslint-disable-next-line camelcase
  change_number: number;
  // eslint-disable-next-line camelcase
  missing_token: boolean;
  // eslint-disable-next-line camelcase
  only_public: boolean;
  details: {
    name: string;
    type: string;
  }
}

export default class Steam {
  private client: any;

  private pics: SteamPICS;

  private user: SteamUser;

  constructor() {
    this.client = new NodeSteam.SteamClient();
    this.pics = new SteamPICS(this.client);
    // @ts-ignore Missing typings
    this.user = new SteamUser(this.client);
  }

  async getAppInfoAsync(appid: number): Promise<AppInfo | undefined> {
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
      logger.info('Connected to Steam');
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
        throw new Error('Steam login failed');
      }

      logger.info('Logged in to Steam');
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
