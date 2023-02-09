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

interface MentionModificationArguments {
  role?: string;
  user?: string;
}

type SingleModificationArgument = WatcherArgument & MentionModificationArguments;

interface EditArguments {
  all: MentionModificationArguments;
  single: SingleModificationArgument;
}

interface CommandArguments {
  add?: EditArguments;
  list?: WatcherArgument;
  remove?: EditArguments;
}

const RoleArg = {
  type: CommandOptionType.ROLE,
  name: 'role',
  description: 'Role to mention',
};

const UserArg = {
  type: CommandOptionType.USER,
  name: 'user',
  description: 'User to mention',
};

const WatcherArg = {
  type: CommandOptionType.INTEGER,
  name: 'watcher_id',
  description: 'The watcher\'s id',
  autocomplete: true,
  required: true,
};

export default class MentionsCommand extends GuildOnlyCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'mentions',
      description: 'Manage mentions for a watcher.',
      dmPermission: false,
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
      options: [{
        type: CommandOptionType.SUB_COMMAND_GROUP,
        name: 'add',
        description: 'Role and/or user to add to a watcher.',
        options: [{
          type: CommandOptionType.SUB_COMMAND,
          name: 'all',
          description: 'Role and/or user to add to all watchers.',
          options: [
            RoleArg,
            UserArg,
          ],
        }, {
          type: CommandOptionType.SUB_COMMAND,
          name: 'single',
          description: 'Role and/or user to add to a single watcher.',
          options: [
            WatcherArg,
            RoleArg,
            UserArg,
          ],
        }],
      }, {
        type: CommandOptionType.SUB_COMMAND,
        name: 'list',
        description: 'List mentions for a watcher.',
        options: [
          WatcherArg,
        ],
      }, {
        type: CommandOptionType.SUB_COMMAND_GROUP,
        name: 'remove',
        description: 'Role and/or user to remove from a watcher.',
        options: [{
          type: CommandOptionType.SUB_COMMAND,
          name: 'all',
          description: 'Role and/or user to remove from all watchers.',
          options: [
            RoleArg,
            UserArg,
          ],
        }, {
          type: CommandOptionType.SUB_COMMAND,
          name: 'single',
          description: 'Role and/or user to remove from  a single watcher.',
          options: [
            WatcherArg,
            RoleArg,
            UserArg,
          ],
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
      if (add.all) {
        return MentionsCommand.addAll(ctx, add.all);
      }

      return MentionsCommand.addSingle(ctx, add.single);
    }

    if (list) {
      return MentionsCommand.list(ctx, list.watcher_id);
    }

    if (remove!.all) {
      return MentionsCommand.removeAll(ctx, remove!.all);
    }

    return MentionsCommand.removeSingle(ctx, remove!.single);
  }

  private static async addAll(ctx: CommandContext, { role, user }: MentionModificationArguments) {
    const mentions = [role, user].filter((m) => m) as string[];

    const max = await db.count('* AS count')
      .from('watcher')
      .innerJoin('watcher_mention', 'watcher_mention.watcher_id', 'watcher.id')
      .orderBy('count', 'desc')
      .first()
      .then((res: any) => parseInt(res.count, 10) || 0);

    if (max && max >= env.settings.maxMentionsPerWatcher) {
      return ctx.error(`Reached the maximum amount of ${env.settings.maxMentionsPerWatcher} mentions for one or more watchers!`);
    }

    if (env.settings.maxMentionsPerWatcher < (max + mentions.length)) {
      return ctx.error(`Adding ${mentions.length} mention(s) would exceed the maximum of ${env.settings.maxMentionsPerWatcher} mentions for one or more watchers!`);
    }

    const createInsertQuery = (entityId: string, type: string) => db.insert(
      db.select(db.raw('watcher.id, ?, ?', [entityId, type]))
        .from('watcher')
        .leftJoin('watcher_mention', (builder) => builder.on('watcher_mention.watcher_id', 'watcher.id')
          .andOn('watcher_mention.entity_id', entityId))
        .whereNull('watcher_mention.watcher_id'),
    )
      .into(db.raw('?? (??, ??, ??)', ['watcher_mention', 'watcher_id', 'entity_id', 'type']));

    if (role) {
      await createInsertQuery(role, 'role');
    }

    if (user) {
      await createInsertQuery(user, 'member');
    }

    return ctx.success(`Added ${mentions.length} mention(s) to all watchers`);
  }

  private static async addSingle(
    ctx: CommandContext,
    { role, user, watcher_id: watcherId }: SingleModificationArgument,
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

  private static async removeAll(
    ctx: CommandContext,
    { role, user }: MentionModificationArguments,
  ) {
    const mentions = [role, user].filter((m) => m) as string[];

    const removed = await db.delete()
      .from('watcher_mention')
      .innerJoin('watcher', 'watcher.id', 'watcher_mention.watcher_id')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
      .whereIn('entity_id', mentions)
      .andWhere('guild_id', ctx.guildID!);

    if (removed === 0) {
      return ctx.error('None of the provided mentions can be removed!');
    }

    return ctx.success(`Removed ${mentions.length} mention(s) from ${removed} watcher(s)`);
  }

  private static async removeSingle(
    ctx: CommandContext,
    { role, user, watcher_id: watcherId }: SingleModificationArgument,
  ) {
    const mentions = [role, user].filter((m) => m) as string[];

    const dbWatcher = await db.select('watcher.id')
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
