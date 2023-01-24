import { oneLine, stripIndents } from 'common-tags';
import {
  AutocompleteContext,
  CommandContext,
  CommandOptionType,
  SlashCreator,
} from 'slash-create';
import {
  db,
  EMBED_COLOURS,
  EMOJIS,
  env,
  SteamUtil,
} from '@steamwatch/shared';
import GuildOnlyCommand from '../../GuildOnlyCommand';

interface WatcherArgument {
  watcher_id: number;
}

interface MentionModification {
  role?: string;
  user?: string;
}

type EditArguments = WatcherArgument & MentionModification;

interface CommandArguments {
  add?: EditArguments;
  list?: WatcherArgument;
  remove?: EditArguments;
}

export default class MentionsCommand extends GuildOnlyCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'mentions',
      description: 'Manage mentions for a watcher.',
      dmPermission: false,
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
      options: [{
        type: CommandOptionType.SUB_COMMAND,
        name: 'add',
        description: 'Role and/or user to add to a watcher.',
        options: [{
          type: CommandOptionType.INTEGER,
          name: 'watcher_id',
          description: 'The watcher\'s id',
          autocomplete: true,
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
        description: 'List mentions for a watcher.',
        options: [{
          type: CommandOptionType.INTEGER,
          name: 'watcher_id',
          description: 'The watcher\'s id',
          autocomplete: true,
          required: true,
        }],
      }, {
        type: CommandOptionType.SUB_COMMAND,
        name: 'remove',
        description: 'Role and/or user to remove from a watcher.',
        options: [{
          type: CommandOptionType.INTEGER,
          name: 'watcher_id',
          description: 'The watcher\'s id',
          autocomplete: true,
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

  // eslint-disable-next-line class-methods-use-this
  override async autocomplete(ctx: AutocompleteContext) {
    if (!ctx.guildID) {
      return ctx.sendResults([]);
    }

    const value = ctx.options[ctx.subcommands[0]!][ctx.focused];

    return ctx.sendResults(await GuildOnlyCommand.createWatcherAutocomplete(value, ctx.guildID!));
  }

  override async run(ctx: CommandContext) {
    try {
      await this.setupGuild(ctx);
    } catch {
      return null;
    }

    const {
      add,
      list,
      remove,
    } = ctx.options as CommandArguments;

    if (add) {
      return MentionsCommand.add(ctx, add);
    }

    if (list) {
      return MentionsCommand.list(ctx, list.watcher_id);
    }

    return MentionsCommand.remove(ctx, remove!);
  }

  private static async add(
    ctx: CommandContext,
    { role, user, watcher_id: watcherId }: EditArguments,
  ) {
    let mentions = [role, user].filter((m) => m);

    const dbMentions = await MentionsCommand.fetchMentions(ctx.guildID!, watcherId);

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
    }))).into('watcher_mention');

    return this.list(ctx, watcherId, `${EMOJIS.SUCCESS} Added ${mentions.length} mention(s)`);
  }

  private static async list(ctx: CommandContext, watcherId: number, description?: string) {
    const mentions = await MentionsCommand.fetchMentions(ctx.guildID!, watcherId);

    if (mentions.length === 0) {
      return ctx.error(`Unable to find a watcher with the identifier **${watcherId}**!`);
    }

    const roles = [];
    const users = [];

    for (let i = 0; i < mentions.length; i += 1) {
      const mention = mentions[i];

      if (mention.type === 'role') {
        roles.push(mention.entityId === ctx.guildID ? '@everyone' : `<@&${mention.entityId}>`);
      } else if (mention.type === 'member') {
        users.push(`<@${mention.entityId}>`);
      }
    }

    return ctx.embed({
      color: EMBED_COLOURS.SUCCESS,
      title: mentions[0].ugcName || mentions[0].appName,
      ...(description ? {
        description,
      } : {}),
      thumbnail: {
        url: SteamUtil.URLS.Icon(mentions[0].id, mentions[0].icon),
      },
      url: mentions[0].ugcId
        ? SteamUtil.URLS.UGC(mentions[0].ugcId)
        : SteamUtil.URLS.Store(mentions[0].id),
      timestamp: new Date(),
      footer: {
        text: mentions[0].appName,
        icon_url: SteamUtil.URLS.Icon(mentions[0].id, mentions[0].icon),
      },
      fields: [{
        name: 'Roles',
        value: roles.join('\n') || 'None',
        inline: true,
      }, {
        name: 'Users',
        value: users.join('\n') || 'None',
        inline: true,
      }, {
        name: 'Steam Client Link',
        value: mentions[0].ugcId
          ? SteamUtil.BP.UGC(mentions[0].ugcId)
          : SteamUtil.BP.Store(mentions[0].id),
      }],
    });
  }

  private static async remove(
    ctx: CommandContext,
    { role, user, watcher_id: watcherId }: EditArguments,
  ) {
    const mentions = [role, user].filter((m) => m) as string[];

    const dbWatcher = await db.select('id')
      .from('watcher')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
      .where({
        'watcher.id': watcherId,
        guildId: ctx.guildID,
      })
      .first();

    if (!dbWatcher) {
      return ctx.error(`Unable to find a watcher with the identifier **${watcherId}**!`);
    }

    const removed = await db.delete()
      .from('watcher_mention')
      .whereIn('entity_id', mentions)
      .andWhere('watcher_id', watcherId);

    if (removed === 0) {
      return ctx.error('None of the provided mentions can be removed!');
    }

    return this.list(ctx, watcherId, `${EMOJIS.SUCCESS} Removed ${removed} mention(s)`);
  }

  private static fetchMentions(guildId: string, watcherId: number) {
    return db.select(
      'watcher_mention.entity_id',
      'watcher_mention.type',
      'app.id',
      { appName: 'app.name' },
      'app.icon',
      { ugcId: 'ugc.id' },
      { ugcName: 'ugc.name' },
    )
      .from('watcher')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
      .leftJoin('ugc', 'ugc.id', 'watcher.ugc_id')
      .leftJoin('app', (builder) => builder.on('app.id', 'watcher.app_id')
        .orOn('app.id', 'ugc.app_id'))
      .leftJoin('watcher_mention', 'watcher_mention.watcher_id', 'watcher.id')
      .where({
        'watcher.id': watcherId,
        guildId,
      });
  }
}
