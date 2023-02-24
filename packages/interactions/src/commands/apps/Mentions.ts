import { oneLine, stripIndents } from 'common-tags';
import {
  AutocompleteContext,
  CommandContext,
  CommandOptionType,
  SlashCreator,
} from 'slash-create';
import {
  db,
  EmbedBuilder,
  EMBED_COLOURS,
  EMOJIS,
  env,
  EPublishedFileInfoMatchingFileType as EPFIMFileType,
  SteamUtil,
  WatcherType,
} from '@steamwatch/shared';
import CommonCommandOptions from '../../CommonCommandOptions';
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
            CommonCommandOptions.Watcher,
            RoleArg,
            UserArg,
          ],
        }],
      }, {
        type: CommandOptionType.SUB_COMMAND,
        name: 'list',
        description: 'List mentions for a watcher.',
        options: [
          CommonCommandOptions.Watcher,
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
            CommonCommandOptions.Watcher,
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

    const value = (ctx.options[ctx.subcommands[0]!][ctx.subcommands[1]!]
        || ctx.options[ctx.subcommands[0]!])[ctx.focused];

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
      .groupBy('watcher.id')
      .orderBy('count', 'desc')
      .first()
      .then((res: any) => parseInt(res?.count || '0', 10));

    if (max && max >= env.settings.maxMentionsPerWatcher) {
      return ctx.error(`Reached the maximum amount of ${env.settings.maxMentionsPerWatcher} mentions for one or more watchers!`);
    }

    if (env.settings.maxMentionsPerWatcher < (max + mentions.length)) {
      return ctx.error(`Adding ${mentions.length} mention(s) would exceed the maximum amount of ${env.settings.maxMentionsPerWatcher} mentions for one or more watchers!`);
    }

    const bulkInsert = async (entityId: string, type: string) => {
      const watchers = await db.select('watcher.id AS id')
        .from('watcher')
        .leftJoin('watcher_mention', (builder) => builder.on('watcher_mention.watcher_id', 'watcher.id')
          .andOn('watcher_mention.entity_id', entityId))
        .whereNull('watcher_mention.watcher_id');

      if (!watchers.length) {
        return [];
      }

      return db.insert(watchers.map((w: any) => ({ watcherId: w.id, entityId, type })))
        .into('watcher_mention');
    };

    let total = 0;

    if (role) {
      total += (await bulkInsert(role, 'role')).length;
    }

    if (user) {
      total += (await bulkInsert(user, 'member')).length;
    }

    return ctx.success(total
      ? `Added ${mentions.length} mention(s) to all watchers`
      : 'Mentions have already been assigned');
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

      if (mention.entityType === 'role') {
        roles.push(mention.entityId === ctx.guildID ? '@everyone' : `<@&${mention.entityId}>`);
      } else if (mention.entityType === 'member') {
        users.push(`<@${mention.entityId}>`);
      }
    }

    let title = mentions[0].groupName || mentions[0].appName;
    let url;
    let bp;

    switch (mentions[0].type) {
      case WatcherType.Curator:
        url = SteamUtil.URLS.Curator(parseInt(mentions[0].groupId, 10));
        bp = SteamUtil.BP.Group(parseInt(mentions[0].groupId, 10));
        break;
      case WatcherType.Forum:
        title = `${mentions[0].forumName} (${mentions[0].appName || mentions[0].groupName})`;
        url = SteamUtil.URLS.Forum(
          mentions[0].appId,
          mentions[0].groupId,
          mentions[0].forumSubforumId,
          mentions[0].forumType,
        );
        bp = SteamUtil.BP.OpenUrl(url);
        break;
      case WatcherType.Group:
        url = SteamUtil.URLS.Group(mentions[0].groupId);
        bp = SteamUtil.BP.Group(parseInt(mentions[0].groupId, 10));
        break;
      case WatcherType.News:
        url = SteamUtil.URLS.AppNews(parseInt(mentions[0].appId, 10));
        bp = SteamUtil.BP.AppNews(parseInt(mentions[0].appId, 10));
        break;
      case WatcherType.UGC:
        title = `${mentions[0].ugcName} (${mentions[0].appName})`;
        url = SteamUtil.URLS.UGC(mentions[0].ugcId);
        bp = SteamUtil.BP.UGC(mentions[0].ugcId);
        break;
      case WatcherType.WorkshopNew:
      case WatcherType.WorkshopUpdate:
        url = SteamUtil.URLS.Workshop(parseInt(mentions[0].appId, 10));
        bp = SteamUtil.BP.Workshop(parseInt(mentions[0].appId, 10));
        break;
      default:
        url = SteamUtil.URLS.Store(parseInt(mentions[0].appId, 10));
        bp = SteamUtil.BP.Store(parseInt(mentions[0].appId, 10));
    }

    return ctx.embed({
      color: EMBED_COLOURS.SUCCESS,
      title,
      ...(description ? {
        description,
      } : {}),
      thumbnail: {
        url: EmbedBuilder.getImage(mentions[0].type, {
          ...mentions[0],
          groupAvatarSize: 'medium',
        }),
      },
      url,
      timestamp: new Date(),
      footer: {
        text: mentions[0].groupName || mentions[0].appName,
        icon_url: EmbedBuilder.getImage(mentions[0].type, {
          ...mentions[0],
          groupAvatarSize: 'medium',
        }),
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
        name: 'Type',
        value: oneLine`
          ${mentions[0].type}
          ${(mentions[0].workshopId ? `(${EPFIMFileType[mentions[0].workshopFiletype]})` : '')}
        `,
        inline: true,
      }, {
        name: 'Steam Client Link',
        value: bp,
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

    return ctx.success(removed === 0
      ? 'None of the provided mentions needed to be removed'
      : `Removed ${mentions.length} mention(s) from ${removed} watcher(s)`);
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
      'watcher.*',
      { entityId: 'watcher_mention.entity_id' },
      { entityType: 'watcher_mention.type' },
      { appId: 'app.id' },
      { appIcon: 'icon' },
      { appName: 'app.name' },
      { forumName: 'forum.name' },
      { forumSubforumId: 'forum.subforumId' },
      { forumType: 'forum.type' },
      { groupId: '`group`.id' },
      { groupAvatar: '`group`.avatar' },
      { groupName: '`group`.name' },
      { ugcId: 'ugc.id' },
      { ugcName: 'ugc.name' },
      { workshopFiletype: 'app_workshop.filetype' },
    )
      .from('watcher')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
      .leftJoin('app_workshop', 'app_workshop.id', 'watcher.workshop_id')
      .leftJoin('forum', 'forum.id', 'watcher.forum_id')
      .leftJoin('`group`', (builder) => builder.on('`group`.id', 'watcher.group_id')
        .orOn('`group`.id', 'forum.group_id'))
      .leftJoin('ugc', 'ugc.id', 'watcher.ugc_id')
      .leftJoin('app', (builder) => builder.on('app.id', 'watcher.app_id')
        .orOn('app.id', 'app_workshop.app_id')
        .orOn('app.id', 'forum.app_id')
        .orOn('app.id', 'ugc.app_id'))
      .leftJoin('watcher_mention', 'watcher_mention.watcher_id', 'watcher.id')
      .where({
        'watcher.id': watcherId,
        guildId,
      });
  }
}
