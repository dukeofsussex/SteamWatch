import { CommandMessage } from 'discord.js-commando';
import db from '../../../db';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import SteamWatchClient from '../../structures/SteamWatchClient';
import { EMBED_COLOURS } from '../../../utils/constants';
import { insertEmoji, capitalize } from '../../../utils/templateTags';

export default class UnwatchCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'unwatch',
      group: 'apps',
      memberName: 'unwatch',
      description: 'Remove a watcher.',
      examples: [
        'unwatch 1',
        'unwatch 1 price',
        'unwatch 1 news',
      ],
      format: '<watcher id> <"all" | "price" | "news">',
      guildOnly: true,
      // @ts-ignore Missing typings
      userPermissions: ['MANAGE_CHANNELS'],
      argsPromptLimit: 0,
      args: [
        {
          key: 'watcherId',
          prompt: 'Watcher id',
          type: 'integer',
        },
        {
          key: 'option',
          prompt: 'Option',
          type: 'string',
          // @ts-ignore Missing typings
          oneOf: ['all', 'price', 'news'],
        },
      ],
      throttling: {
        duration: 10,
        usages: 2,
      },
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async run(
    message: CommandMessage,
    { watcherId, option }: { watcherId: number, option: 'all' | 'price' | 'news' },
  ) {
    const watcher = await db.select('app_watcher.watchNews', 'app_watcher.watchPrice', 'app.name')
      .from('app_watcher')
      .innerJoin('app', 'app.id', 'app_watcher.app_id')
      .where({
        'app_watcher.id': watcherId,
        guildId: message.guild.id,
      })
      .first();

    if (!watcher) {
      return message.embed({
        color: EMBED_COLOURS.ERROR,
        description: insertEmoji`:ERROR: Unable to find a watcher with the identifier **${watcherId}**!`,
      });
    }

    if (option === 'all'
        || (option === 'price' && !watcher.watchNews)
        || (option === 'news' && !watcher.watchPrice)) {
      await db.delete()
        .from('app_watcher')
        .where('id', watcherId);

      return message.embed({
        color: EMBED_COLOURS.SUCCESS,
        description: insertEmoji`:SUCCESS: Watcher removed for **${watcher.name}**!`,
      });
    }

    await db('app_watcher').update({
      watchNews: !(option === 'news'),
      watchPrice: !(option === 'price'),
    })
      .where('id', watcherId);

    return message.embed({
      color: EMBED_COLOURS.SUCCESS,
      description: insertEmoji`:SUCCESS: ${capitalize(option)} watcher removed for **${watcher.name}**!`,
    });
  }
}
