import { oneLine, stripIndents } from 'common-tags';
import { GuildMember, Role } from 'discord.js';
import { CommandMessage } from 'discord.js-commando';
import db from '../../../db';
import env from '../../../env';
import SteamWatchClient from '../../structures/SteamWatchClient';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import { EMBED_COLOURS } from '../../../utils/constants';
import { insertEmoji } from '../../../utils/templateTags';

export default class AddMentionCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'addmention',
      group: 'apps',
      memberName: 'addmention',
      description: 'Add mentions to a watcher.',
      details: oneLine`Mentions can be a comma-separated list of any combination
        of direct mentions, user ids, usernames, role ids and role names.`,
      examples: [
        'addmention 1 MyName',
        'addmention 1 JustTheRoleName,@Me,209752756708311041',
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
    { watcherId, mentions }: { watcherId: number, mentions: (Role | GuildMember)[] },
  ) {
    // Filter duplicates
    let filteredMentions = mentions.filter((v, i, a) => a.findIndex((m) => m.id === v.id) === i);

    const dbMentions = await db.select('app_watcher_mention.entity_id', 'app.name')
      .from('app_watcher')
      .innerJoin('app', 'app.id', 'app_watcher.app_id')
      .leftJoin('app_watcher_mention', 'app_watcher_mention.watcher_id', 'app_watcher.id')
      .where({
        'app_watcher.id': watcherId,
        guildId: message.guild.id,
      });

    if (dbMentions.length === 0) {
      return message.embed({
        color: EMBED_COLOURS.ERROR,
        description: insertEmoji`:ERROR: Unable to find a watcher with the identifier **${watcherId}**!`,
      });
    }

    if (dbMentions.length >= env.settings.maxMentionsPerWatcher) {
      return message.embed({
        color: EMBED_COLOURS.ERROR,
        description: insertEmoji(oneLine)`
          :ERROR: Reached the maximum amount of mentions for this watcher
          [${dbMentions.length}/${env.settings.maxMentionsPerWatcher}]!
        `,
      });
    }

    if (dbMentions.length > 0) {
      const existingIds = dbMentions.map((mention) => mention.entityId);
      filteredMentions = filteredMentions.filter((mention) => !existingIds.includes(mention.id));

      if (dbMentions.length + filteredMentions.length > env.settings.maxMentionsPerWatcher) {
        filteredMentions = filteredMentions.slice(
          0,
          env.settings.maxMentionsPerWatcher - dbMentions.length,
        );
      }

      if (filteredMentions.length === 0) {
        return message.embed({
          color: EMBED_COLOURS.ERROR,
          description: insertEmoji(stripIndents)`
            :ERROR: Nothing to add!
            Use ${message.anyUsage('mentions 1')} to view already added mentions.
          `,
        });
      }
    }

    await db.insert(filteredMentions.map((mention) => ({
      watcherId,
      entityId: mention.id,
      type: mention instanceof Role ? 'role' : 'member',
    }))).into('app_watcher_mention');

    return message.embed({
      color: EMBED_COLOURS.SUCCESS,
      description: insertEmoji`:SUCCESS: Added mentions to **${dbMentions[0].name}**.`,
      fields: [{
        name: 'Roles',
        value: filteredMentions.filter((mention) => mention instanceof Role)
          .map((mention: any) => mention.name)
          .join('\n') || 'None',
        inline: true,
      }, {
        name: 'Users',
        value: filteredMentions.filter((mention) => mention instanceof GuildMember)
          .map((mention: any) => mention.displayName)
          .join('\n') || 'None',
        inline: true,
      }],
    });
  }
}
