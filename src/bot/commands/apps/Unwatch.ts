import { CommandMessage } from 'discord.js-commando';
import SteamWatchClient from '../../structures/SteamWatchClient';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import db from '../../../db';
import WebApi from '../../../steam/WebApi';
import { EMBED_COLOURS } from '../../../utils/constants';
import { insertEmoji } from '../../../utils/templateTags';

export default class UnwatchCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'unwatch',
      group: 'apps',
      memberName: 'unwatch',
      description: 'Remove a watcher.',
      examples: [
        'unwatch 1',
      ],
      format: '<watcher id>',
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
    { watcherId }: { watcherId: number },
  ) {
    const watcher = await db.select(
      'app_watcher.id',
      'app_watcher.app_id',
      'app.name',
      'icon',
      'channel_id',
    ).from('app_watcher')
      .innerJoin('app', 'app.id', 'app_watcher.app_id')
      .where({
        'app_watcher.id': watcherId,
        'app_watcher.guild_id': message.guild.id,
      })
      .first();

    if (!watcher) {
      return message.embed({
        color: EMBED_COLOURS.ERROR,
        description: insertEmoji`:ERROR: Unable to find a watcher with the identifier **${watcherId}**!`,
      });
    }

    await db.delete()
      .from('app_watcher')
      .where('id', watcher.id);

    return message.embed({
      color: EMBED_COLOURS.SUCCESS,
      description: insertEmoji`:SUCCESS: Removed watcher for **${watcher.name}** from <#${watcher.channelId}>!`,
      thumbnail: {
        url: WebApi.getIconUrl(watcher.appId, watcher.icon),
      },
    });
  }
}
