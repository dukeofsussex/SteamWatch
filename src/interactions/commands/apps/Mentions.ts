import { oneLine, stripIndents } from 'common-tags';
import { CommandContext, CommandOptionType, SlashCreator } from 'slash-create';
import GuildOnlyCommand from '../../GuildOnlyCommand';
import db from '../../../db';
import { SteamUtil } from '../../../steam/SteamUtil';
import { EMBED_COLOURS, EMOJIS } from '../../../utils/constants';
import env from '../../../utils/env';

interface WatcherArgument {
  watcher_id: number;
}

interface MentionModification {
  role?: string;
  user?: string;
}

type AddArguments = WatcherArgument & MentionModification;
type RemoveArguments = AddArguments;

interface CommandArguments {
  add?: AddArguments;
  list?: WatcherArgument;
  remove?: RemoveArguments;
}

export default class AddMentionCommand extends GuildOnlyCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'mentions',
      description: 'Manage mentions for a watcher.',
      guildIDs: env.dev ? [env.devGuildId] : undefined,
      options: [{
        type: CommandOptionType.SUB_COMMAND,
        name: 'add',
        description: 'Role and/or user to add to a watcher.',
        options: [{
          type: CommandOptionType.NUMBER,
          name: 'watcher_id',
          description: 'The watcher\'s id',
          required: true,
        }, {
          type: CommandOptionType.USER,
          name: 'user',
          description: 'User to mention',
        }, {
          type: CommandOptionType.ROLE,
          name: 'role',
          description: 'Role to mention',
        }],
      }, {
        type: CommandOptionType.SUB_COMMAND,
        name: 'list',
        description: 'List mentions for the watcher',
        options: [{
          type: CommandOptionType.NUMBER,
          name: 'watcher_id',
          description: 'The watcher\'s id',
          required: true,
        }],
      }, {
        type: CommandOptionType.SUB_COMMAND,
        name: 'remove',
        description: 'Role and/or user to remove from a watcher.',
        options: [{
          type: CommandOptionType.NUMBER,
          name: 'watcher_id',
          description: 'The watcher\'s id',
          required: true,
        }, {
          type: CommandOptionType.USER,
          name: 'user',
          description: 'User to remove',
        }, {
          type: CommandOptionType.ROLE,
          name: 'role',
          description: 'Role to remove',
        }],
      }],
      requiredPermissions: ['MANAGE_CHANNELS'],
      throttling: {
        duration: 5,
        usages: 1,
      },
    });

    this.filePath = __filename;
  }

  async run(ctx: CommandContext) {
    try {
      await GuildOnlyCommand.setupGuild(ctx);
    } catch {
      return null;
    }

    const {
      add,
      list,
      remove,
    } = ctx.options as CommandArguments;

    if (add) {
      return this.add(ctx, add);
    }

    if (list) {
      return this.list(ctx, list.watcher_id);
    }

    return this.remove(ctx, remove!);
  }

  // eslint-disable-next-line class-methods-use-this
  async add(ctx: CommandContext, { role, user, watcher_id: watcherId }: AddArguments) {
    let mentions = [role, user].filter((m) => m);

    const dbMentions = await db.select('app_watcher_mention.entity_id', 'app.id', 'app.name', 'app.icon')
      .from('app_watcher')
      .innerJoin('app', 'app.id', 'app_watcher.app_id')
      .leftJoin('app_watcher_mention', 'app_watcher_mention.watcher_id', 'app_watcher.id')
      .where({
        'app_watcher.id': watcherId,
        guildId: ctx.guildID,
      });

    if (dbMentions.length === 0) {
      return ctx.error(`Unable to find a watcher with the identifier **${watcherId}**!`);
    }

    if (dbMentions.length >= env.settings.maxMentionsPerWatcher) {
      return ctx.error(oneLine`
        Reached the maximum amount of mentions for this watcher
        [${dbMentions.length}/${env.settings.maxMentionsPerWatcher}]!
      `);
    }

    if (dbMentions.length > 0) {
      const existingIds = dbMentions.map((mention) => mention.entityId);
      mentions = mentions.filter((mention) => !existingIds.includes(mention));

      if ((dbMentions.length + mentions.length) > env.settings.maxMentionsPerWatcher) {
        mentions = mentions.slice(
          0,
          env.settings.maxMentionsPerWatcher - dbMentions.length,
        );
      }

      if (mentions.length === 0) {
        return ctx.error(stripIndents`
            Nothing to add!
            Use \`/mentions list watcher_id: ${watcherId}\` to view already added mentions.
          `);
      }
    }

    await db.insert(mentions.map((mention) => ({
      watcherId,
      entityId: mention,
      type: mention === role ? 'role' : 'member',
    }))).into('app_watcher_mention');

    return this.list(ctx, watcherId, `${EMOJIS.SUCCESS} Added ${mentions.length} mention(s)`);
  }

  // eslint-disable-next-line class-methods-use-this
  async list(ctx: CommandContext, watcherId: number, description?: string) {
    const mentions = await db.select('app_watcher_mention.entity_id', 'app_watcher_mention.type', 'app.id', 'app.name', 'app.icon')
      .from('app_watcher')
      .innerJoin('app', 'app.id', 'app_watcher.app_id')
      .leftJoin('app_watcher_mention', 'app_watcher_mention.watcher_id', 'app_watcher.id')
      .where({
        'app_watcher.id': watcherId,
        guildId: ctx.guildID,
      });

    if (mentions.length === 0) {
      return ctx.error(`Unable to find a watcher with the identifier **${watcherId}**!`);
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

    return ctx.embed({
      color: EMBED_COLOURS.SUCCESS,
      title: mentions[0].name,
      description,
      thumbnail: {
        url: SteamUtil.getIconUrl(mentions[0].id, mentions[0].icon),
      },
      url: SteamUtil.getStoreUrl(mentions[0].id),
      timestamp: new Date(),
      footer: {
        text: `Watcher Id: ${watcherId}`,
      },
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

  // eslint-disable-next-line class-methods-use-this
  async remove(ctx: CommandContext, { role, user, watcher_id: watcherId }: RemoveArguments) {
    const mentions = [role, user].filter((m) => m) as string[];

    const dbWatcher = await db.select('app.id', 'app.name', 'app.icon')
      .from('app_watcher')
      .innerJoin('app', 'app.id', 'app_watcher.app_id')
      .where({
        'app_watcher.id': watcherId,
        guildId: ctx.guildID,
      })
      .first();

    if (!dbWatcher) {
      return ctx.error(`Unable to find a watcher with the identifier **${watcherId}**!`);
    }

    const removed = await db.delete()
      .from('app_watcher_mention')
      .whereIn('entity_id', mentions)
      .andWhere('watcher_id', watcherId);

    if (removed === 0) {
      return ctx.error('None of the provided mentions can be removed!');
    }

    return this.list(ctx, watcherId, `${EMOJIS.SUCCESS} Removed ${removed} mention(s)`);
  }
}
