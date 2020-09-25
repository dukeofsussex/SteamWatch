import { oneLineTrim } from 'common-tags';
import { Permissions } from 'discord.js';
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

  get inviteUrl() {
    const perms = new Permissions([
      Permissions.FLAGS.EMBED_LINKS!,
      Permissions.FLAGS.MANAGE_WEBHOOKS!,
      Permissions.FLAGS.SEND_MESSAGES!,
      Permissions.FLAGS.VIEW_CHANNEL!,
    ]).bitfield;

    return oneLineTrim`
      https://discord.com/oauth2/authorize
      ?client_id=${this.user!.id}
      &permissions=${perms}
      &scope=bot
    `;
  }

  login(token: string) {
    this.steam.initAsync();
    return super.login(token);
  }

  destroy() {
    this.steam.quit();
    return super.destroy();
  }
}
