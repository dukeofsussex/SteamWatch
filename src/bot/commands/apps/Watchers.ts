import { GuildChannel, TextChannel } from 'discord.js';
import { CommandMessage } from 'discord.js-commando';
import SteamWatchClient from '../../structures/SteamWatchClient';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import db from '../../../db';
import { EMBED_COLOURS } from '../../../utils/constants';
import { insertEmoji } from '../../../utils/templateTags';

const table = require('markdown-table');

export default class WatchersCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'watchers',
      group: 'apps',
      memberName: 'watchers',
      description: 'List app watchers.',
      examples: [
        'watchers',
        'watchers 730',
        'watchers #general',
      ],
      format: '[app id | channel]',
      guildOnly: true,
      // @ts-ignore Missing typings
      userPermissions: ['MANAGE_CHANNELS'],
      argsPromptLimit: 0,
      args: [
        {
          key: 'identifier',
          prompt: 'Identifier',
          type: 'channel|app-id',
          default: -1,
        },
      ],
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async run(message: CommandMessage, { identifier }: { identifier: number | GuildChannel }) {
    let notFoundCategory = 'for this guild';
    let query = db.select('app.name', 'app_watcher.*')
      .from('app')
      .innerJoin('app_watcher', 'app.id', 'app_watcher.app_id')
      .where('guild_id', message.guild.id);

    if (typeof identifier === 'number' && identifier !== -1) {
      notFoundCategory = `for **${identifier}**`;
      query = query.andWhere('app_id', identifier);
    } else if (identifier instanceof GuildChannel) {
      if (!(identifier instanceof TextChannel)) {
        return message.embed({
          color: EMBED_COLOURS.ERROR,
          description: insertEmoji`:ERROR: **${identifier}** isn't a text channel!`,
        });
      }

      notFoundCategory = `for ${identifier}`;
      query = query.andWhere('channel_id', identifier.id);
    }

    const watchers = await query.orderBy('name', 'asc');

    if (watchers.length === 0) {
      return message.embed({
        color: EMBED_COLOURS.ERROR,
        description: insertEmoji`:ERROR: No watchers configured ${notFoundCategory}!`,
      });
    }

    return message.code('md', table([
      ['Id', 'App Id', 'Name', 'Channel', 'Types'],
      ...watchers.map((w) => [
        w.id,
        w.appId,
        w.name,
        `#${message.guild.channels.get(w.channelId)?.name}`,
        [w.watchNews ? 'News' : '', w.watchPrice ? 'Price' : ''].filter((type) => type).join(','),
      ]),
    ]));
  }
}
