import { CommandMessage } from 'discord.js-commando';
import db from '../../../db';
import SteamWatchCommand from '../../../structures/SteamWatchCommand';
import SteamWatchClient from '../../../structures/SteamWatchClient';
import { EMBED_COLOURS } from '../../../utils/constants';
import { insertEmoji } from '../../../utils/templateTags';

export default class MentionsCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'mentions',
      group: 'apps',
      memberName: 'mentions',
      description: 'List mentions for a watcher.',
      examples: [
        'mentions 1',
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
      ],
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async run(message: CommandMessage, { watcherId }: { watcherId: number }) {
    const mentions = await db.select('app_watcher_mention.entity_id', 'app_watcher_mention.type', 'app.name')
      .from('app_watcher')
      .innerJoin('app', 'app.id', 'app_watcher.app_id')
      .leftJoin('app_watcher_mention', 'app_watcher_mention.watcher_id', 'app_watcher.id')
      .where({
        watcherId,
        guildId: message.guild.id,
      });

    if (mentions.length === 0) {
      return message.embed({
        color: EMBED_COLOURS.ERROR,
        description: insertEmoji`:ERROR: Unable to find a watcher with the identifier **${watcherId}**!`,
      });
    }
    if (mentions.length === 1 && !mentions[0].entityId) {
      return message.embed({
        color: EMBED_COLOURS.DEFAULT,
        description: 'No mentions configured!',
      });
    }

    const roles = [];
    const users = [];

    for (let i = 0; i < mentions.length; i += 1) {
      const mention = mentions[i];

      if (mention.type === 'role') {
        roles.push(message.guild.roles.get(mention.entityId)?.name || 'N/A');
      } else {
        users.push(message.guild.members.get(mention.entityId)?.user.username || 'N/A');
      }
    }

    return message.embed({
      color: EMBED_COLOURS.SUCCESS,
      title: `Mentions for ${mentions[0].name}`,
      fields: [{
        name: 'Roles',
        value: roles.join('\n') || 'None',
        inline: true,
      }, {
        name: 'Users',
        value: users.join('\n') || 'None',
        inline: true,
      }],
    });
  }
}
