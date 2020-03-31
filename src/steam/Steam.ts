import SteamPICS from './handlers/PICS';
import SteamUser from './SteamUser';
import env from '../env';
import logger from '../logger';
import { existsAsync, readFileAsync, writeFileAsync } from '../utils/fsAsync';

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
    icon: string;
  }
}

export default class Steam {
  private client: any;

  private pics: SteamPICS;

  private listeners: Map<string, Function>;

  private user: SteamUser;

  constructor() {
    this.client = new NodeSteam.SteamClient();
    this.pics = new SteamPICS(this.client);
    // @ts-ignore Missing typings
    this.user = new SteamUser(this.client);
    this.listeners = new Map();
  }

  async getAppInfoAsync(appId: number): Promise<AppInfo | undefined> {
    return new Promise((resolve) => {
      this.pics.getProductInfo([{ appId, only_public: true }], (result: any) => {
        resolve(result.apps[0] || undefined);
      });
    });
  }

  get isAvailable() {
    return this.client.loggedOn;
  }

  async initAsync() {
    if (await existsAsync('servers.json')) {
      NodeSteam.servers = JSON.parse((await readFileAsync('servers.json')).toString());
    }

    this.listeners.set('connected', () => {
      logger.info({
        group: 'Steam',
        message: 'Connected',
      });
      this.user.logOnAnon();
    })
      .set('error', (err: Error) => {
        logger.error({
          group: 'Steam',
          message: err,
        });

        if (!this.client.loggedOn) {
          logger.info({
            group: 'Steam',
            message: 'Reconnecting',
          });

          setTimeout(() => this.client.connect(), 15000);
        }
      })
      .set('logOnResponse', (res: any) => {
        if (res.eresult !== NodeSteam.EResult.OK) {
          logger.error({
            group: 'Steam',
            message: `Failed to log in:\n${JSON.stringify(res, null, 2)}`,
          });
        } else {
          logger.info({
            group: 'Steam',
            message: 'Logged in',
          });
        }
      })
      .set('loggedOff', () => {
        logger.info({
          group: 'Steam',
          message: 'Logged out',
        });
      })
      .set('servers', (servers: object) => writeFileAsync('servers.json', JSON.stringify(servers)));

    if (env.debug) {
      this.listeners.set('debug', (message: string) => {
        logger.debug({
          group: 'Steam',
          message,
        });
      });
    }

    this.listeners.forEach((listener, event) => this.client.on(event, listener));
    this.client.connect();
  }

  quit() {
    this.client.disconnect();
    this.listeners.forEach((listener, event) => this.client.removeListener(event, listener));
  }
}
