import { CommandoClient, CommandoClientOptions } from 'discord.js-commando';
import Steam from '../../steam/Steam';

export interface SteamWatchClientOptions extends CommandoClientOptions {
  steam: Steam;
}

export default class SteamWatchClient extends CommandoClient {
  readonly steam: Steam;

  constructor(options: SteamWatchClientOptions) {
    super(options);
    this.steam = options.steam;
  }

  login(token: string) {
    this.steam.init();
    return super.login(token);
  }

  destroy() {
    this.steam.quit();
    return super.destroy();
  }
}
