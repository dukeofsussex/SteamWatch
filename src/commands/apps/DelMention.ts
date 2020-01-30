import { oneLine } from 'common-tags';
import { Role, User } from 'discord.js';
import { CommandMessage } from 'discord.js-commando';
import db from '../../db';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import SteamWatchClient from '../../structures/SteamWatchClient';
import { EMBED_COLOURS } from '../../utils/constants';
import { insertEmoji } from '../../utils/templateTags';

export default class DelMentionCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'delmention',
      group: 'apps',
      memberName: 'delmention',
      description: 'Delete mentions from a watcher.',
      details: oneLine`Mentions can be a comma-separated list of any combination
        of direct mentions, user ids, usernames, role ids and role names.`,
      examples: [
        'delmention 1 MyName',
        'delmention 1 JustTheRoleName,@Me,209752756708311041',
      ],
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
          key: 'mentions',
          prompt: 'Mentions',
          type: 'mention-list',
        },
      ],
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async run(
    message: CommandMessage,
    { watcherId, mentions }: { watcherId: number, mentions: (Role | User)[] },
  ) {
    const dbWatcher = await db.select('app.name')
      .from('app_watcher')
      .innerJoin('app', 'app.id', 'app_watcher.app_id')
      .where({
        'app_watcher.id': watcherId,
        guildId: message.guild.id,
      })
      .first();

    if (!dbWatcher) {
      return message.embed({
        color: EMBED_COLOURS.ERROR,
        description: insertEmoji(oneLine)`
          :ERROR: Unable to find a watcher with the identifier
          **${watcherId}**!
        `,
      });
    }

    const removed = await db.delete()
      .from('app_watcher_mention')
      .whereIn('entity_id', mentions.map((mention) => mention.id))
      .andWhere('watcher_id', watcherId);

    if (removed === 0) {
      return message.embed({
        color: EMBED_COLOURS.ERROR,
        description: insertEmoji`:ERROR: None of the provided mentions can be removed!`,
      });
    }

    return message.embed({
      color: EMBED_COLOURS.SUCCESS,
      description: insertEmoji`:SUCCESS: Mentions removed from **${dbWatcher.name}**.`,
    });
  }
}
