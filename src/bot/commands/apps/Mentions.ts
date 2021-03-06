import { CommandoMessage } from 'discord.js-commando';
import SteamWatchClient from '../../structures/SteamWatchClient';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import db from '../../../db';
import WebApi from '../../../steam/WebApi';
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
  async run(message: CommandoMessage, { watcherId }: { watcherId: number }) {
    const mentions = await db.select('app_watcher_mention.entity_id', 'app_watcher_mention.type', 'app.id', 'app.name', 'app.icon')
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
        roles.push(`<@&${mention.entityId}>`);
      } else {
        users.push(`<@${mention.entityId}>`);
      }
    }

    return message.embed({
      color: EMBED_COLOURS.SUCCESS,
      title: mentions[0].name,
      thumbnail: {
        url: WebApi.getIconUrl(mentions[0].id, mentions[0].icon),
      },
      url: WebApi.getStoreUrl(mentions[0].id),
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
