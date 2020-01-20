import { Command, CommandoClient, CommandMessage } from 'discord.js-commando';
import db from '../db';

const { version } = require('../../package.json');

const countQuery = db.count('* AS count')
  .first();

function msToTime(ms: number) {
  let seconds = (ms / 1000);
  let minutes = Math.floor(seconds / 60);
  seconds %= 60;
  let hours = Math.floor(minutes / 60);
  minutes %= 60;
  const days = Math.floor(hours / 24);
  hours %= 24;

  return `${days}d:${hours}h:${minutes}m`;
}

export default class InfoCommand extends Command {
  constructor(client: CommandoClient) {
    super(client, {
      name: 'info',
      aliases: ['stats'],
      group: 'util',
      memberName: 'info',
      description: 'Display information about the bot',
      throttling: {
        duration: 30,
        usages: 1,
      },
    });
  }

  async run(message: CommandMessage) {
    const guildCount = this.client.guilds.size.toString();
    const appCount = await countQuery.clone()
      .from('app')
      .then((res: any) => res.count);
    const watcherCount = await countQuery.clone()
      .from('app_watcher')
      .then((res: any) => res.count);
    const uptime = msToTime(this.client.uptime);

    return message.embed({
      title: 'SteamWatch Statistics',
      url: 'https://steamwatch.xyz',
      color: 0xF1C40F,
      timestamp: new Date(),
      footer: {
        icon_url: this.client.user.avatarURL,
        text: `SteamWatch v${version}`,
      },
      fields: [
        {
          name: 'Guilds',
          value: guildCount,
          inline: true,
        },
        {
          name: 'Apps',
          value: appCount,
          inline: true,
        },
        {
          name: 'Watchers',
          value: watcherCount,
          inline: true,
        },
        {
          name: 'Uptime',
          value: uptime,
        },
      ],
    });
  }
}
