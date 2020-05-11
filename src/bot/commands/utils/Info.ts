import { CommandoMessage } from 'discord.js-commando';
import SteamWatchClient from '../../structures/SteamWatchClient';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import db from '../../../db';
import env from '../../../env';
import { EMBED_COLOURS } from '../../../utils/constants';

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
      group: 'utils',
      memberName: 'info',
      aliases: ['stats'],
      description: 'Display information about the bot.',
      clientPermissions: ['EMBED_LINKS'],
      throttling: {
        duration: 30,
        usages: 1,
      },
    });
  }

  async run(message: CommandoMessage) {
    const countQuery = db.count('* AS count')
      .first();

    const counts = await Promise.all([
      countQuery.clone()
        .from('guild')
        .whereNot('id', 0)
        .then((res: any) => res.count),
      db.countDistinct('app_id AS count')
        .from('app_watcher')
        .first()
        .then((res: any) => res.count),
      countQuery.clone()
        .from('app_watcher')
        .then((res: any) => res.count),
    ]);
    const uptime = msToTime(this.client.uptime!);
    const links = [
      `[Invite Bot](${this.client.inviteUrl})`,
      `[GitHub Repo](${env.repoUrl})`,
      `[Support](${env.bot.invite})`,
      '[Website](https://steam.watch)',
    ];

    return message.embed({
      title: 'SteamWatch Statistics',
      url: 'https://steam.watch',
      color: EMBED_COLOURS.DEFAULT,
      timestamp: new Date(),
      footer: {
        icon_url: this.client.user!.displayAvatarURL(),
        text: `SteamWatch v${version}`,
      },
      fields: [
        {
          name: 'Guilds',
          value: counts[0],
          inline: true,
        },
        {
          name: 'Apps',
          value: counts[1],
          inline: true,
        },
        {
          name: 'Watchers',
          value: counts[2],
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
