import { ArgumentType } from 'discord.js-commando';
import SteamWatchClient from '../../structures/SteamWatchClient';

export default class AppIdType extends ArgumentType {
  constructor(client: SteamWatchClient) {
    super(client, 'app-id');
  }

  // @ts-ignore Missing typings
  // eslint-disable-next-line class-methods-use-this
  async validate(val: string) {
    const appId = Number.parseInt(val, 10);
    if (!Number.isNaN(appId)) {
      return appId > 0;
    }

    const matches = val.match(/\/app\/(\d+)\/?/);
    if (matches) {
      return parseInt(matches[1], 10) > 0;
    }

    return false;
  }

  // @ts-ignore Missing typings
  // eslint-disable-next-line class-methods-use-this
  parse(val: string) {
    const appId = parseInt(val, 10);

    if (!Number.isNaN(appId) && Number.isFinite(appId)) {
      return appId;
    }

    const matches = val.match(/\/app\/(\d+)\/?/);
    if (matches) {
      return parseInt(matches[1], 10);
    }

    return 0;
  }

  // eslint-disable-next-line class-methods-use-this
  isEmpty(val: string) {
    return !val || val.length === 0;
  }
}
