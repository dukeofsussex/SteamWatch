import type { DiscordAPIError } from '@discordjs/rest';
import { oneLine, stripIndents } from 'common-tags';
import {
  PermissionFlagsBits,
  RESTGetAPIChannelWebhooksResult,
  RESTJSONErrorCodes,
  RESTPostAPIChannelWebhookResult,
  Routes,
} from 'discord-api-types/v10';
import {
  AutocompleteContext,
  ButtonStyle,
  ChannelType,
  CommandContext,
  CommandOptionType,
  ComponentType,
  SlashCreator,
} from 'slash-create';
import {
  AppType,
  capitalize,
  db,
  DEFAULT_COMPONENT_EXPIRATION,
  DEFAULT_STEAM_ICON,
  DiscordAPI,
  EmbedBuilder,
  EMBED_COLOURS,
  env,
  EPublishedFileInfoMatchingFileType as EPFIMFileType,
  EPublishedFileQueryType,
  ForumType,
  logger,
  PatreonUtils,
  PriceType,
  SteamAPI,
  steamClient,
  SteamUtil,
  STEAM_NEWS_APPID,
  StoreItem,
  UGC,
  WatcherType,
} from '@steamwatch/shared';
import CommonCommandOptions from '../../CommonCommandOptions';
import GuildOnlyCommand from '../../GuildOnlyCommand';

const markdownTable = require('markdown-table');

const MAX_MESSAGE_LENGTH = 2000;

const ChannelArg = {
  type: CommandOptionType.CHANNEL,
  name: 'channel',
  description: 'The channel notifications should be sent to',
  required: true,
  // TODO Replace magic number with enum once typings have been fixed upstream
  channel_types: [ChannelType.GUILD_NEWS, ChannelType.GUILD_TEXT, 15],
};

const ThreadArg = {
  type: CommandOptionType.STRING,
  name: 'thread',
  description: 'The thread notifications should be sent to (ONLY REQUIRED IF THE CHANNEL IS A FORUM)',
  autocomplete: true,
  required: false,
};

interface BaseArguments {
  channel: string;
  thread?: string;
}

interface AddAppArguments extends BaseArguments {
  app: string;
}

interface AddAppTypedArguments extends BaseArguments {
  app: string;
  watcherType: WatcherType.News
  | WatcherType.Price
  | WatcherType.WorkshopNew
  | WatcherType.WorkshopUpdate;
}

interface AddForumArguments extends BaseArguments {
  forum: string;
}

interface AddGroupArguments extends BaseArguments {
  curator?: string;
  group?: string;
  watcherType: WatcherType.Curator | WatcherType.Group;
}

interface AddUGCArguments extends BaseArguments {
  ugc: string;
}

interface AddWorkshopArguments extends AddAppArguments {
  filetype: EPFIMFileType;
  type: WatcherType.WorkshopNew | WatcherType.WorkshopUpdate;
}

interface AddArguments {
  curator: Omit<AddGroupArguments, 'group'>;
  forum: AddForumArguments;
  free: BaseArguments;
  group: Omit<AddGroupArguments, 'curator'>;
  news: AddAppArguments;
  price: AddAppArguments;
  steam: BaseArguments;
  ugc: AddUGCArguments;
  workshop: AddWorkshopArguments;
}

type ListArguments = BaseArguments;

interface RemoveArguments {
  watcher_id: number;
}

interface CommandArguments {
  add?: AddArguments;
  list?: ListArguments;
  remove?: RemoveArguments;
}

export default class WatchersCommand extends GuildOnlyCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'watchers',
      description: 'Manage app watchers.',
      dmPermission: false,
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
      options: [{
        type: CommandOptionType.SUB_COMMAND_GROUP,
        name: 'add',
        description: 'Add a watcher for a Steam item.',
        options: [{
          type: CommandOptionType.SUB_COMMAND,
          name: 'curator',
          description: 'Watch a Steam curator for reviews.',
          options: [
            CommonCommandOptions.Curator,
            ChannelArg,
            ThreadArg,
          ],
        }, {
          type: CommandOptionType.SUB_COMMAND,
          name: 'forum',
          description: 'Watch a Steam forum for posts.',
          options: [
            {
              type: CommandOptionType.STRING,
              name: 'forum',
              description: 'Forum url',
              required: true,
            },
            ChannelArg,
            ThreadArg,
          ],
        }, {
          type: CommandOptionType.SUB_COMMAND,
          name: 'free',
          description: 'Watch Steam for free promotions.',
          options: [
            ChannelArg,
            ThreadArg,
          ],
        }, {
          type: CommandOptionType.SUB_COMMAND,
          name: 'group',
          description: 'Watch a Steam group for news.',
          options: [
            CommonCommandOptions.Group,
            ChannelArg,
            ThreadArg,
          ],
        }, {
          type: CommandOptionType.SUB_COMMAND,
          name: 'news',
          description: 'Watch a Steam app for news.',
          options: [
            CommonCommandOptions.App,
            ChannelArg,
            ThreadArg,
          ],
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'price',
          description: 'Watch a Steam app for price changes.',
          options: [
            CommonCommandOptions.App,
            ChannelArg,
            ThreadArg,
          ],
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'steam',
          description: 'Watch Steam for (Valve) news.',
          options: [
            ChannelArg,
            ThreadArg,
          ],
        }, {
          type: CommandOptionType.SUB_COMMAND,
          name: 'ugc',
          description: 'Watch a workshop item/user-generated content.',
          options: [
            CommonCommandOptions.UGC,
            ChannelArg,
            ThreadArg,
          ],
        }, {
          type: CommandOptionType.SUB_COMMAND,
          name: 'workshop',
          description: 'Watch a Steam app\'s workshop.',
          options: [
            {
              type: CommandOptionType.STRING,
              name: 'type',
              description: 'The type of workshop changes to watch',
              required: true,
              choices: [{
                name: 'New submissions',
                value: WatcherType.WorkshopNew,
              }, {
                name: 'Updates to existing submissions',
                value: WatcherType.WorkshopUpdate,
              }],
            },
            CommonCommandOptions.WorkshopFileType,
            CommonCommandOptions.App,
            ChannelArg,
            ThreadArg,
          ],
        }],
      }, {
        type: CommandOptionType.SUB_COMMAND,
        name: 'list',
        description: 'List app watchers.',
        options: [
          {
            ...ChannelArg,
            description: 'The channel notifications are being sent to',
            required: false,
          },
        ],
      }, {
        type: CommandOptionType.SUB_COMMAND,
        name: 'remove',
        description: 'Remove a watcher.',
        options: [
          CommonCommandOptions.Watcher,
        ],
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

    if (ctx.focused === 'watcher_id') {
      const value = ctx.options[ctx.subcommands[0]!][ctx.focused];
      return ctx.sendResults(await GuildOnlyCommand.createWatcherAutocomplete(value, ctx.guildID!));
    }

    const value = ctx.options[ctx.subcommands[0]!][ctx.subcommands[1]!][ctx.focused];

    if (ctx.focused === 'thread') {
      return ctx.sendResults(await GuildOnlyCommand.createThreadAutocomplete(value, ctx.guildID!));
    }

    return ctx.sendResults(await SteamUtil.createAppAutocomplete(value));
  }

  override async run(ctx: CommandContext) {
    try {
      await this.setupGuild(ctx);
    } catch {
      return null;
    }

    if (!ctx.appPermissions?.has(PermissionFlagsBits.ManageWebhooks)) {
      return ctx.error('This bot requires the `MANAGE_WEBHOOKS` permission! Please check the assigned role(s).');
    }

    const { add, list, remove } = ctx.options as CommandArguments;

    if (!steamClient.connected) {
      return ctx.error('Currently not connected to Steam. Please try again in a few minutes');
    }

    if (add) {
      const error = await WatchersCommand.hasReachedMaxWatchers(ctx.guildID!);

      if (error) {
        return ctx.error(error);
      }

      const addSub = add[ctx.subcommands[1]! as keyof AddArguments];

      // TODO Replace magic number with enum once typings have been fixed upstream
      if (ctx.channels.get(addSub.channel)!.type === 15
          && !addSub.thread) {
        return ctx.error('A thread is required when using forum channels!');
      }

      if (add.curator) {
        return WatchersCommand.addGroup(ctx, {
          ...add.curator,
          watcherType: WatcherType.Curator,
        });
      }

      if (add.forum) {
        return WatchersCommand.addForum(ctx, add.forum);
      }

      if (add.free) {
        return WatchersCommand.addFree(ctx, add.free);
      }

      if (add.group) {
        return WatchersCommand.addGroup(ctx, {
          ...add.group,
          watcherType: WatcherType.Group,
        });
      }

      if (add.news) {
        return WatchersCommand.addApp(ctx, {
          ...add.news,
          watcherType: WatcherType.News,
        });
      }

      if (add.price) {
        return WatchersCommand.addApp(ctx, {
          ...add.price,
          watcherType: WatcherType.Price,
        });
      }

      if (add.steam) {
        return WatchersCommand.addApp(ctx, {
          ...add.steam,
          app: STEAM_NEWS_APPID.toString(),
          watcherType: WatcherType.News,
        });
      }

      if (add.ugc) {
        return WatchersCommand.addUGC(ctx, add.ugc);
      }

      if (add.workshop) {
        return WatchersCommand.addApp(ctx, {
          ...add.workshop,
          watcherType: add.workshop.type,
        });
      }
    }

    if (list) {
      return WatchersCommand.list(ctx, list);
    }

    return WatchersCommand.remove(ctx, remove!);
  }

  private static async addApp(
    ctx: CommandContext,
    {
      app: query,
      channel: channelId,
      watcherType,
      thread: threadId,
      filetype,
    }: AddAppTypedArguments & Partial<AddWorkshopArguments>,
  ) {
    const { id, type } = await SteamUtil.findStoreItem(query);

    if (!id) {
      return ctx.error(`Unable to find a store page for: ${query}`);
    }

    let item: StoreItem | null;

    if (watcherType === WatcherType.Price && type === PriceType.Bundle) {
      item = (await db.select('id', 'name', '"bundle" AS type')
        .from('bundle')
        .where('id', id)
        .first()) || (await SteamUtil.persistBundle(id));
    } else if (watcherType === WatcherType.Price && type === PriceType.Sub) {
      item = (await db.select('id', 'name', '"sub" AS type')
        .from('sub')
        .where('id', id)
        .first()) || (await SteamUtil.persistSub(id));
    } else {
      if (!SteamUtil.canHaveWatcher(type as AppType, watcherType)) {
        return ctx.error(`${capitalize(watcherType)} watchers aren't supported for apps of type **${type}**!`);
      }

      item = (await db.select('id', 'name', 'icon', 'type')
        .from('app')
        .where('id', id)
        .first()) || (await SteamUtil.persistApp(id));
    }

    if (!item?.id) {
      return ctx.error(`Unable to find a Store item with the id **${id}**!`);
    }

    // New bundles and subs don't have an assigned type property
    item.type = type;

    const priceType = item.type !== PriceType.Bundle && item.type !== PriceType.Sub
      ? PriceType.App
      : item.type;

    await ctx.editOriginal({
      embeds: [{
        color: EMBED_COLOURS.PENDING,
        description: `Would you like to add the watcher for **${item.name} (${item.type})** to <#${(threadId || channelId)}>?`,
        title: 'Confirmation',
        ...(priceType === PriceType.App
          ? {
            thumbnail: {
              url: SteamUtil.URLS.Icon(item.id, item.icon),
            },
          } : {}),
      }],
      components: [{
        type: ComponentType.ACTION_ROW,
        components: [{
          custom_id: 'cancel',
          label: 'Cancel',
          style: ButtonStyle.SECONDARY,
          type: ComponentType.BUTTON,
        }, {
          custom_id: 'confirm',
          label: 'Confirm',
          style: ButtonStyle.PRIMARY,
          type: ComponentType.BUTTON,
        }],
      }],
    });

    ctx.registerComponent(
      'cancel',
      () => ctx.error(`Cancelled watcher for **${item!.name} (${item!.type})** on <#${(threadId || channelId)}>.`, {
        ...(priceType === PriceType.App
          ? {
            thumbnail: {
              url: SteamUtil.URLS.Icon(item!.id, item!.icon),
            },
          } : {}),
      }),
      DEFAULT_COMPONENT_EXPIRATION,
    );

    return ctx.registerComponent(
      'confirm',
      async () => {
        let error = await WatchersCommand.hasReachedMaxWatchers(ctx.guildID!);

        if (error) {
          return ctx.error(error);
        }

        let workshopId = null;

        if (watcherType === WatcherType.WorkshopNew || watcherType === WatcherType.WorkshopUpdate) {
          const { total } = await steamClient.queryFiles(
            item!.id,
            watcherType === WatcherType.WorkshopNew
              ? EPublishedFileQueryType.RankedByPublicationDate
              : EPublishedFileQueryType.RankedByLastUpdatedDate,
            filetype!,
          );

          if (!total) {
            return ctx.error(
              stripIndents`
                **${item!.name}** doesn't have any submissions of type **${EPFIMFileType[filetype!]}**!
                If this is an error, please try again later.
              `,
            );
          }

          workshopId = await db.select('id')
            .from('app_workshop')
            .where({
              appId: item!.id,
              filetype: filetype!,
            })
            .first()
            .then((res) => res?.id);

          if (!workshopId) {
            [workshopId] = await db.insert({
              appId: item!.id,
              filetype,
              lastCheckedNew: null,
              lastCheckedUpdate: null,
            }).into('app_workshop');
          }
        }

        error = await WatchersCommand.setWebhook(channelId, ctx.guildID!);

        if (error) {
          return ctx.error(error);
        }

        const key = SteamUtil.getPriceTypeIdKey(priceType as PriceType);

        if (watcherType === WatcherType.Price) {
          error = await WatchersCommand.setPrice(item!, ctx.guildID!, key);
        }

        if (error) {
          return ctx.error(error);
        }

        const [dbId] = await db.insert({
          [key]: item!.id,
          channelId,
          threadId,
          type: watcherType,
          workshopId,
          inactive: false,
        }).into('watcher');

        ctx.unregisterComponent('confirm');

        return ctx.success(`Added **${watcherType}** watcher (#${dbId}) for **${item!.name} (${item!.type})** to <#${(threadId || channelId)}>.`, {
          ...(priceType === PriceType.App
            ? {
              thumbnail: {
                url: SteamUtil.URLS.Icon(item!.id, item!.icon),
              },
            } : {}),
        });
      },
      DEFAULT_COMPONENT_EXPIRATION,
      () => ctx.timeout(),
    );
  }

  private static async addForum(
    ctx: CommandContext,
    {
      channel: channelId,
      forum: query,
      thread: threadId,
    }: AddForumArguments,
  ) {
    const metadata = await SteamAPI.getForumMetadata(query);

    if (!metadata) {
      return ctx.error(`Unable to process forum at ${query}`);
    }

    if (!Object.values(ForumType).includes(metadata.type.toLowerCase() as ForumType)) {
      logger.error({
        message: 'Unsupported forum type',
        metadata,
      });

      return ctx.error(`Unable to watch forum of type **${metadata.type}**`);
    }

    let forum = (await db.select(
      'forum.*',
      { appId: 'app.id' },
      { appIcon: 'app.icon' },
      { groupAvatar: '`group`.avatar' },
      db.raw('IF(forum.app_id IS NOT NULL, app.name, `group`.name) AS ownerName'),
    )
      .from('forum')
      .leftJoin('app', 'app.id', 'forum.app_id')
      .leftJoin('`group`', 'group.id', 'forum.group_id')
      .where('forum.id', metadata.gidforum)
      .first());

    if (!forum) {
      forum = {
        id: metadata.gidforum,
        appId: metadata.appid ?? null,
        groupId: metadata.appid ? null : metadata.owner,
        subforumId: metadata.feature,
        name: metadata.forum_display_name,
        type: metadata.type.toLowerCase(),
        lastChecked: null,
      };

      let app = null;
      let group = null;

      if (metadata.appid) {
        const appId = parseInt(metadata.appid, 10);

        app = (await db.select('id', 'icon', 'name')
          .from('app')
          .where('id', appId)
          .first()) || (await SteamUtil.persistApp(appId));
      } else {
        const groupId = parseInt(metadata.owner, 10);

        group = (await db.select('avatar', 'name')
          .from('`group`')
          .where('id', groupId)
          .first()) || (await SteamUtil.persistGroup(groupId));
      }

      if (!app && !group) {
        return ctx.error(`Unable to persist forum owner data for ${query}`);
      }

      await db('app').update('oggId', metadata.owner);
      await db.insert(forum)
        .into('forum');

      forum = {
        ...forum,
        appId: app?.id,
        appIcon: app?.icon,
        groupAvatar: group?.avatar,
        ownerName: app?.name ?? group?.name,
      };
    }

    await ctx.editOriginal({
      embeds: [{
        color: EMBED_COLOURS.PENDING,
        description: `Would you like to add the watcher for **${forum.name} (${forum.ownerName})** to <#${(threadId || channelId)}>?`,
        title: 'Confirmation',
        thumbnail: {
          url: EmbedBuilder.getImage(WatcherType.Forum, {
            ...forum,
            groupAvatarSize: 'medium',
          }),
        },
      }],
      components: [{
        type: ComponentType.ACTION_ROW,
        components: [{
          custom_id: 'cancel',
          label: 'Cancel',
          style: ButtonStyle.SECONDARY,
          type: ComponentType.BUTTON,
        }, {
          custom_id: 'confirm',
          label: 'Confirm',
          style: ButtonStyle.PRIMARY,
          type: ComponentType.BUTTON,
        }],
      }],
    });

    ctx.registerComponent(
      'cancel',
      () => ctx.error(`Cancelled watcher for **${forum.name} (${forum.ownerName})** on <#${(threadId || channelId)}>.`, {
        thumbnail: {
          url: EmbedBuilder.getImage(WatcherType.Forum, {
            ...forum,
            groupAvatarSize: 'medium',
          }),
        },
      }),
      DEFAULT_COMPONENT_EXPIRATION,
    );

    return ctx.registerComponent(
      'confirm',
      async () => {
        let error = await WatchersCommand.hasReachedMaxWatchers(ctx.guildID!);

        if (error) {
          return ctx.error(error);
        }

        error = await WatchersCommand.setWebhook(channelId, ctx.guildID!);

        if (error) {
          return ctx.error(error);
        }

        const [id] = await db.insert({
          forumId: forum.id,
          channelId,
          threadId,
          type: WatcherType.Forum,
          inactive: false,
        }).into('watcher');

        ctx.unregisterComponent('confirm');

        return ctx.success(`Added **${WatcherType.Forum}** watcher (#${id}) for **${forum.name} (${forum.ownerName})** to <#${(threadId || channelId)}>.`, {
          thumbnail: {
            url: EmbedBuilder.getImage(WatcherType.Forum, {
              ...forum,
              groupAvatarSize: 'medium',
            }),
          },
        });
      },
      DEFAULT_COMPONENT_EXPIRATION,
      () => ctx.timeout(),
    );
  }

  private static async addFree(
    ctx: CommandContext,
    {
      channel: channelId,
      thread: threadId,
    }: BaseArguments,
  ) {
    await ctx.editOriginal({
      embeds: [{
        color: EMBED_COLOURS.PENDING,
        description: `Would you like to add the watcher for **free promotions** to <#${(threadId || channelId)}>?`,
        title: 'Confirmation',
        thumbnail: {
          url: DEFAULT_STEAM_ICON,
        },
      }],
      components: [{
        type: ComponentType.ACTION_ROW,
        components: [{
          custom_id: 'cancel',
          label: 'Cancel',
          style: ButtonStyle.SECONDARY,
          type: ComponentType.BUTTON,
        }, {
          custom_id: 'confirm',
          label: 'Confirm',
          style: ButtonStyle.PRIMARY,
          type: ComponentType.BUTTON,
        }],
      }],
    });

    ctx.registerComponent(
      'cancel',
      () => ctx.error(`Cancelled watcher for **free promotions** on <#${(threadId || channelId)}>.`),
      DEFAULT_COMPONENT_EXPIRATION,
    );

    return ctx.registerComponent(
      'confirm',
      async () => {
        let error = await WatchersCommand.hasReachedMaxWatchers(ctx.guildID!);

        if (error) {
          return ctx.error(error);
        }

        error = await WatchersCommand.setWebhook(channelId, ctx.guildID!);

        if (error) {
          return ctx.error(error);
        }

        const [id] = await db.insert({
          channelId,
          threadId,
          type: WatcherType.Free,
          inactive: false,
        }).into('watcher');

        ctx.unregisterComponent('confirm');

        return ctx.success(`Added **${WatcherType.Free}** watcher (#${id}) for **free promotions** to <#${(threadId || channelId)}>.`, {
          thumbnail: {
            url: DEFAULT_STEAM_ICON,
          },
        });
      },
      DEFAULT_COMPONENT_EXPIRATION,
      () => ctx.timeout(),
    );
  }

  private static async addGroup(
    ctx: CommandContext,
    {
      channel: channelId,
      curator: curatorId,
      group: groupId,
      thread: threadId,
      watcherType,
    }: AddGroupArguments,
  ) {
    const query = curatorId || groupId!;
    const identifier = SteamUtil.findGroupIdentifier(query);

    if (watcherType === WatcherType.Curator) {
      const details = await SteamAPI.getGroupDetails(identifier);

      if (!details || !details.is_curator) {
        return ctx.error(`Unable to find a curator page for ${SteamUtil.URLS.Group(identifier)}`);
      }
    }

    const group = (await db.select('*')
      .from('`group`')
      .where('id', identifier)
      .orWhere('name', identifier)
      .orWhere('vanityUrl', identifier)
      .first()) || (await SteamUtil.persistGroup(identifier));

    if (!group) {
      return ctx.error(`Unable to find a group with the url ${SteamUtil.URLS.Group(identifier)}`);
    }

    await ctx.editOriginal({
      embeds: [{
        color: EMBED_COLOURS.PENDING,
        description: `Would you like to add the watcher for **${group.name}** to <#${(threadId || channelId)}>?`,
        title: 'Confirmation',
        thumbnail: {
          url: SteamUtil.URLS.GroupAvatar(group.avatar, 'medium'),
        },
      }],
      components: [{
        type: ComponentType.ACTION_ROW,
        components: [{
          custom_id: 'cancel',
          label: 'Cancel',
          style: ButtonStyle.SECONDARY,
          type: ComponentType.BUTTON,
        }, {
          custom_id: 'confirm',
          label: 'Confirm',
          style: ButtonStyle.PRIMARY,
          type: ComponentType.BUTTON,
        }],
      }],
    });

    ctx.registerComponent(
      'cancel',
      () => ctx.error(`Cancelled watcher for **${group!.name}** on <#${(threadId || channelId)}>.`, {
        thumbnail: {
          url: SteamUtil.URLS.GroupAvatar(group.avatar, 'medium'),
        },
      }),
      DEFAULT_COMPONENT_EXPIRATION,
    );

    return ctx.registerComponent(
      'confirm',
      async () => {
        let error = await WatchersCommand.hasReachedMaxWatchers(ctx.guildID!);

        if (error) {
          return ctx.error(error);
        }

        error = await WatchersCommand.setWebhook(channelId, ctx.guildID!);

        if (error) {
          return ctx.error(error);
        }

        const [id] = await db.insert({
          groupId: group!.id,
          channelId,
          threadId,
          type: watcherType,
          inactive: false,
        }).into('watcher');

        ctx.unregisterComponent('confirm');

        return ctx.success(`Added **${watcherType}** watcher (#${id}) for **${group!.name}** to <#${(threadId || channelId)}>.`, {
          thumbnail: {
            url: SteamUtil.URLS.GroupAvatar(group.avatar, 'medium'),
          },
        });
      },
      DEFAULT_COMPONENT_EXPIRATION,
      () => ctx.timeout(),
    );
  }

  private static async addUGC(
    ctx: CommandContext,
    {
      channel: channelId,
      thread: threadId,
      ugc: query,
    }: AddUGCArguments,
  ) {
    const ugcId = SteamUtil.findUGCId(query);

    if (!ugcId) {
      return ctx.error(`Unable to parse UGC identifier: ${query}`);
    }

    let ugc: UGC;

    try {
      ugc = (await db.select('*')
        .from('ugc')
        .where('id', ugcId)
        .first()) || (await SteamUtil.persistUGC(ugcId));
    } catch (err) {
      return ctx.error(`Unable to add UGC watcher! ${(err as Error).message}`);
    }

    const app = await db.select('*')
      .from('app')
      .where('id', ugc.appId)
      .first();

    await ctx.editOriginal({
      embeds: [{
        color: EMBED_COLOURS.PENDING,
        description: `Would you like to add the watcher for **${ugc.name}** to <#${(threadId || channelId)}>?`,
        title: 'Confirmation',
        thumbnail: {
          url: SteamUtil.URLS.Icon(app!.id, app!.icon),
        },
      }],
      components: [{
        type: ComponentType.ACTION_ROW,
        components: [{
          custom_id: 'cancel',
          label: 'Cancel',
          style: ButtonStyle.SECONDARY,
          type: ComponentType.BUTTON,
        }, {
          custom_id: 'confirm',
          label: 'Confirm',
          style: ButtonStyle.PRIMARY,
          type: ComponentType.BUTTON,
        }],
      }],
    });

    ctx.registerComponent(
      'cancel',
      () => ctx.error(`Cancelled watcher for **${ugc!.name}** on <#${(threadId || channelId)}>.`, {
        thumbnail: {
          url: SteamUtil.URLS.Icon(app!.id, app!.icon),
        },
      }),
      DEFAULT_COMPONENT_EXPIRATION,
    );

    return ctx.registerComponent(
      'confirm',
      async () => {
        let error = await WatchersCommand.hasReachedMaxWatchers(ctx.guildID!);

        if (error) {
          return ctx.error(error);
        }

        error = await WatchersCommand.setWebhook(channelId, ctx.guildID!);

        if (error) {
          return ctx.error(error);
        }

        const [id] = await db.insert({
          ugcId: ugc!.id,
          channelId,
          threadId,
          type: WatcherType.UGC,
          inactive: false,
        }).into('watcher');

        ctx.unregisterComponent('confirm');

        return ctx.success(`Added **${WatcherType.UGC}** watcher (#${id}) for **${ugc!.name}** to <#${(threadId || channelId)}>.`, {
          thumbnail: {
            url: SteamUtil.URLS.Icon(app!.id, app!.icon),
          },
        });
      },
      DEFAULT_COMPONENT_EXPIRATION,
      () => ctx.timeout(),
    );
  }

  private static async list(ctx: CommandContext, { channel: channelId }: ListArguments) {
    let dbQuery = db.select(
      db.raw(oneLine`
        CASE
          WHEN watcher.type = 'free' THEN "Free Promotions"
          WHEN watcher.bundle_id IS NOT NULL THEN bundle.name
          WHEN watcher.forum_id IS NOT NULL THEN CONCAT(forum.name, ' (', IF(forum.app_id IS NOT NULL, app.name, \`group\`.name), ')')
          WHEN watcher.group_id IS NOT NULL THEN \`group\`.name
          WHEN watcher.sub_id IS NOT NULL THEN sub.name
          WHEN watcher.ugc_id IS NOT NULL THEN CONCAT(ugc.name, ' (', app.name, ')')
          ELSE app.name
        END AS name
      `),
      'app_workshop.filetype',
      'watcher.*',
    ).from('watcher')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
      .leftJoin('app_workshop', 'app_workshop.id', 'watcher.workshop_id')
      .leftJoin('bundle', 'bundle.id', 'watcher.bundle_id')
      .leftJoin('forum', 'forum.id', 'watcher.forum_id')
      .leftJoin('`group`', (builder) => builder.on('`group`.id', 'watcher.group_id')
        .orOn('`group`.id', 'forum.group_id'))
      .leftJoin('sub', 'sub.id', 'watcher.sub_id')
      .leftJoin('ugc', 'ugc.id', 'watcher.ugc_id')
      .leftJoin('app', (builder) => builder.on('app.id', 'watcher.app_id')
        .orOn('app.id', 'app_workshop.app_id')
        .orOn('app.id', 'forum.app_id')
        .orOn('app.id', 'ugc.app_id'))
      .where('guild_id', ctx.guildID);

    if (channelId) {
      dbQuery = dbQuery.andWhere('channel_webhook.id', channelId);
    }

    const watchers = await dbQuery;

    if (watchers.length === 0) {
      ctx.error('No watchers found!');
      return;
    }

    const channelNames = new Map();
    let batch = [];
    let md = '';

    const createTable = (rows: any[]) => `\`\`\`md\n${markdownTable([
      ['Id', 'Entity Id', 'Name', 'Channel', 'Type', 'Active'],
      ...(rows.map((w: any) => [
        w.id,
        w.appId || w.bundleId || w.forumId || w.groupId || w.subId || w.ugcId || w.workshopId || '-',
        w.name,
        channelNames.get(w.threadId || w.channelId),
        oneLine`
          ${w.type.replace('_', ' ')}
          ${(w.workshopId ? `(${EPFIMFileType[w.filetype]})` : '')}
        `,
        !w.inactive ? 'X' : '',
      ])),
    ], {
      align: ['r', 'r', 'r', 'r', 'r', 'c'],
    })}\`\`\``;

    for (let i = 0; i < watchers.length; i += 1) {
      const watcher = watchers[i];

      if (!channelNames.has(watcher.threadId || watcher.channelId)) {
        channelNames.set(
          watcher.threadId || watcher.channelId,
          // eslint-disable-next-line no-await-in-loop
          await DiscordAPI.getChannelName(watcher.threadId || watcher.channelId),
        );
      }

      batch.push(watcher);

      const newMd = createTable(batch);

      if (newMd.length >= MAX_MESSAGE_LENGTH) {
        // eslint-disable-next-line no-await-in-loop
        await ctx.send({
          content: md,
        });
        md = '';
        batch = [watcher];
      } else {
        md = newMd;
      }
    }

    if (batch.length) {
      await ctx.send({
        content: createTable(batch),
      });
    }
  }

  private static async remove(ctx: CommandContext, { watcher_id: watcherId }: RemoveArguments) {
    const watcher = await db.select(
      'watcher.id',
      'watcher.type',
      { appId: 'app.id' },
      { appIcon: 'icon' },
      { groupAvatar: '`group`.avatar' },
      'channel_id',
      'webhook_id',
      'webhook_token',
      db.raw(oneLine`
        CASE
          WHEN watcher.type = 'free' THEN "Free Promotions"
          WHEN watcher.bundle_id IS NOT NULL THEN bundle.name
          WHEN watcher.forum_id IS NOT NULL THEN CONCAT(forum.name, ' (', IF(forum.app_id IS NOT NULL, app.name, \`group\`.name), ')')
          WHEN watcher.group_id IS NOT NULL THEN \`group\`.name
          WHEN watcher.sub_id IS NOT NULL THEN sub.name
          WHEN watcher.ugc_id IS NOT NULL THEN CONCAT(ugc.name, ' (', app.name, ')')
          ELSE app.name
        END AS name
      `),
    ).from('watcher')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
      .leftJoin('app_workshop', 'app_workshop.id', 'watcher.workshop_id')
      .leftJoin('bundle', 'bundle.id', 'watcher.bundle_id')
      .leftJoin('forum', 'forum.id', 'watcher.forum_id')
      .leftJoin('`group`', (builder) => builder.on('`group`.id', 'watcher.group_id')
        .orOn('`group`.id', 'forum.group_id'))
      .leftJoin('sub', 'sub.id', 'watcher.sub_id')
      .leftJoin('ugc', 'ugc.id', 'watcher.ugc_id')
      .leftJoin('app', (builder) => builder.on('app.id', 'watcher.app_id')
        .orOn('app.id', 'app_workshop.app_id')
        .orOn('app.id', 'forum.app_id')
        .orOn('app.id', 'ugc.app_id'))
      .where({
        'watcher.id': watcherId,
        guildId: ctx.guildID,
      })
      .first();

    if (!watcher) {
      return ctx.error(`Unable to find a watcher with the identifier **${watcherId}**!`);
    }

    await db.delete()
      .from('watcher')
      .where('id', watcher.id);

    const count = await db.count('* AS count')
      .from('watcher')
      .where('channel_id', watcher.channelId)
      .first()
      .then((res: any) => parseInt(res.count, 10));

    if (count === 0) {
      await db.delete()
        .from('channel_webhook')
        .where('id', watcher.channelId);

      try {
        await DiscordAPI.delete(Routes.webhook(watcher.webhookId));
      } catch (err) {
        if ((err as DiscordAPIError).code === RESTJSONErrorCodes.UnknownWebhook) {
          logger.info('Webhook already removed');
        } else {
          logger.error('Unable to remove webhook!');
        }
      }
    }

    return ctx.success(`Removed **${watcher.type}** watcher (#${watcherId}) for **${watcher.name}** from <#${watcher.channelId}>!`, {
      thumbnail: {
        url: EmbedBuilder.getImage(watcher.type, {
          ...watcher,
          groupAvatarSize: 'medium',
        }),
      },
    });
  }

  private static async hasReachedMaxWatchers(guildId: string) {
    const result = await db.select(db.raw('COUNT(*) AS count'), 'pledge_tier')
      .from('watcher')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
      .leftJoin('patron', 'patron.guild_id', 'channel_webhook.guild_id')
      .where('channel_webhook.guild_id', guildId)
      .andWhere('inactive', false)
      .groupBy('patron.id');
    const count = result[0]?.count ?? 0;
    const max = env.settings.maxWatchersPerGuild
      + PatreonUtils.getExtraWatchers(result.map((watcher) => watcher.pledgeTier || 0));

    return (count >= max)
      ? stripIndents`
          Reached the maximum amount of watchers [${count}/${max}]!
          Visit [Patreon](https://patreon.com/steamwatch) for subscriptions to increase your maximum.
        `
      : null;
  }

  private static async setWebhook(channelId: string, guildId: string) {
    const dbWebhook = await db.select('id')
      .from('channel_webhook')
      .where('id', channelId)
      .first();

    if (dbWebhook) {
      return null;
    }

    const webhooks = await DiscordAPI.get(Routes.channelWebhooks(channelId)) as
      RESTGetAPIChannelWebhooksResult;

    if (webhooks.length >= 10) {
      return stripIndents`
        <#${channelId}> already has the maximum amount of webhooks.
        Please remove any unused webhooks and try again.
      `;
    }

    const me = await DiscordAPI.getCurrentUser();

    const webhook = await DiscordAPI.post(Routes.channelWebhooks(channelId), {
      body: {
        name: me.username,
        avatar: me.avatar,
        reason: `Required by ${me.username}`,
      },
    }) as RESTPostAPIChannelWebhookResult;

    await db.insert({
      id: channelId,
      guildId,
      webhookId: webhook.id,
      webhookToken: webhook.token,
    }).into('channel_webhook');

    return null;
  }

  private static async setPrice(item: StoreItem, guildId: string, key: string) {
    const price = await db.select(
      'price.id',
      'guild.currency_id',
      'currency.code',
      'currency.country_code',
    ).from('guild')
      .innerJoin('currency', 'currency.id', 'guild.currency_id')
      .leftJoin('price', (builder) => builder.on(key, item.id.toString())
        .andOn('price.currency_id', 'currency.id'))
      .where('guild.id', guildId)
      .first();

    // Don't have the app <> currency combination in the db
    if (!price.id) {
      const storePrices = await SteamUtil.getStorePrices(
        [item.id],
        item.type,
        price.code,
        price.countryCode,
      );

      if (!storePrices[item.id]) {
        return stripIndents`
        ${oneLine`
          Unable to watch app prices for **${item.name} (${item.type})**
          in **${price.code}**!`}
        This may be due to regional restrictions, or the app is either free or doesn't have a (regional) price assigned..
        You can change your currency using \`/currency\`
      `;
      }

      await db.insert({
        appId: item.type !== PriceType.Bundle && item.type !== PriceType.Sub ? item.id : null,
        bundleId: item.type === PriceType.Bundle ? item.id : null,
        subId: item.type === PriceType.Sub ? item.id : null,
        currencyId: price.currencyId,
        price: storePrices[item.id]!.initial,
        discountedPrice: storePrices[item.id]!.final,
        discount: storePrices[item.id]!.discount,
        lastChecked: new Date(),
        lastUpdate: new Date(),
      }).into('price');
    }

    return null;
  }
}
