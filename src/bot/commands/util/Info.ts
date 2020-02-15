import { CommandMessage } from 'discord.js-commando';
import db from '../../../db';
import env from '../../../env';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import SteamWatchClient from '../../structures/SteamWatchClient';

const { version } = require('../../../../package.json');

function msToTime(ms: number) {
  let seconds = (ms / 1000);
  let minutes = Math.floor(seconds / 60);
  seconds %= 60;
  let hours = Math.floor(minutes / 60);
  minutes %= 60;
  const days = Math.floor(hours / 24);
  hours %= 24;

  return `${days} days, ${hours} hours and ${minutes} minutes`;
}

export default class InfoCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'info',
      group: 'util',
      memberName: 'info',
      aliases: ['stats'],
      description: 'Display information about the bot.',
      throttling: {
        duration: 30,
        usages: 1,
      },
    });
  }

  async run(message: CommandMessage) {
    const countQuery = db.count('* AS count')
      .first();

    const guildCount = this.client.guilds.size.toString();
    const appCount = await countQuery.clone()
      .from('app')
      .then((res: any) => res.count);
    const watcherCount = await countQuery.clone()
      .from('app_watcher')
      .then((res: any) => res.count);
    const uptime = msToTime(this.client.uptime);
    const links = [
      `[Invite Bot](https://discordapp.com/oauth2/authorize?client_id=${this.client.user.id}&scope=bot)`,
      '[GitHub Repo](https://github.com/dukeofsussex/SteamWatch)',
      `[Support](${env.bot.invite})`,
      '[Website](https://steam.watch)',
    ];

    return message.embed({
      title: 'SteamWatch Statistics',
      url: 'https://steam.watch',
      color: 0x00ADEE,
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
        {
          name: 'Links',
          value: links.join(' | '),
        },
      ],
    });
  }
}
