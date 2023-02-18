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
  App,
  AppType,
  capitalize,
  db,
  DEFAULT_COMPONENT_EXPIRATION,
  DiscordAPI,
  EmbedBuilder,
  EMBED_COLOURS,
  env,
  EPublishedFileInfoMatchingFileType as EPFIMFileType,
  EPublishedFileQueryType,
  logger,
  PatreonUtils,
  SteamAPI,
  steamClient,
  SteamUtil,
  STEAM_NEWS_APPID,
  UGC,
  WatcherType,
} from '@steamwatch/shared';
import GuildOnlyCommand from '../../GuildOnlyCommand';

const markdownTable = require('markdown-table');

const MAX_MESSAGE_LENGTH = 2000;

interface BaseArguments {
  query: string;
  channel: string;
  thread_id?: string;
}

interface WorkshopArguments extends BaseArguments {
  filetype: EPFIMFileType;
  type: WatcherType.WorkshopNew | WatcherType.WorkshopUpdate;
}

interface AddArguments {
  curator: BaseArguments;
  group: BaseArguments;
  news: BaseArguments;
  price: BaseArguments;
  steam: Pick<BaseArguments, 'channel' | 'thread_id'>;
  ugc: BaseArguments;
  workshop: WorkshopArguments;
}

interface AddTypeArguments extends BaseArguments {
  watcherType: WatcherType
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
  name: 'thread_id',
  description: 'The thread notifications should be sent to (ONLY REQUIRED IF THE CHANNEL IS A FORUM)',
  autocomplete: true,
  required: false,
};

const QueryArg = {
  type: CommandOptionType.STRING,
  name: 'query',
  description: 'App id, name or url',
  autocomplete: true,
  required: true,
};

const WorkshopFileTypeArg = {
  type: CommandOptionType.INTEGER,
  name: 'filetype',
  description: 'The type of workshop submissions to watch',
  required: true,
  choices: Object.keys(EPFIMFileType)
    .filter((ft) => [
      'Items',
      'Collections',
      'Art',
      'Videos',
      'Screenshots',
      'Guides',
      'Merch',
      'Microtransaction',
    ].includes(ft))
    .map((ft) => ({
      name: ft,
      value: EPFIMFileType[ft as keyof typeof EPFIMFileType],
    })),
};

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
          description: 'Watch a Steam curator for reviews',
          options: [
            {
              ...QueryArg,
              description: 'Curator id, name or url',
              autocomplete: false,
            },
            ChannelArg,
            ThreadArg,
          ],
        }, {
          type: CommandOptionType.SUB_COMMAND,
          name: 'group',
          description: 'Watch a Steam group for news',
          options: [
            {
              ...QueryArg,
              description: 'Group id, name or url',
              autocomplete: false,
            },
            ChannelArg,
            ThreadArg,
          ],
        }, {
          type: CommandOptionType.SUB_COMMAND,
          name: 'news',
          description: 'Watch a Steam app for news',
          options: [
            QueryArg,
            ChannelArg,
            ThreadArg,
          ],
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'price',
          description: 'Watch a Steam app for price changes',
          options: [
            QueryArg,
            ChannelArg,
            ThreadArg,
          ],
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'steam',
          description: 'Watch Steam for (Valve) news',
          options: [
            ChannelArg,
            ThreadArg,
          ],
        }, {
          type: CommandOptionType.SUB_COMMAND,
          name: 'ugc',
          description: 'Watch a workshop item/user-generated content',
          options: [
            {
              ...QueryArg,
              autocomplete: false,
              description: 'UGC id or url',
            },
            ChannelArg,
            ThreadArg,
          ],
        }, {
          type: CommandOptionType.SUB_COMMAND,
          name: 'workshop',
          description: 'Watch a Steam app\'s workshop',
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
            WorkshopFileTypeArg,
            QueryArg,
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
          {
            type: CommandOptionType.INTEGER,
            name: 'watcher_id',
            description: 'The watcher\'s id',
            autocomplete: true,
            required: true,
          },
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

    if (ctx.focused === 'thread_id') {
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
          && !addSub.thread_id) {
        return ctx.error('A thread is required when using forum channels!');
      }

      if (add.curator) {
        return WatchersCommand.addGroup(ctx, {
          ...add.curator,
          watcherType: WatcherType.Curator,
        });
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
          channel: add.steam.channel,
          query: STEAM_NEWS_APPID.toString(),
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
      channel: channelId,
      query,
      watcherType,
      thread_id: threadId,
      filetype,
    }: AddTypeArguments & Partial<WorkshopArguments>,
  ) {
    const appId = await SteamUtil.findAppId(query);

    if (!appId) {
      return ctx.error(`Unable to find an application with the id/name: ${query}`);
    }

    const app = (await db.select('*')
      .from('app')
      .where('id', appId)
      .first()) || (await SteamUtil.persistApp(appId));

    if (!app) {
      return ctx.error(stripIndents`
        Unable to find an app with the id **${appId}**!
        Make sure the id doesn't belong to a package or bundle.
      `);
    }

    if (!SteamUtil.canHaveWatcher(app.type.toLowerCase() as AppType, watcherType)) {
      return ctx.error(`${capitalize(watcherType)} watchers aren't supported for apps of type **${app.type}**!`);
    }

    await ctx.editOriginal({
      embeds: [{
        color: EMBED_COLOURS.PENDING,
        description: `Would you like to add the watcher for **${app.name} (${app.type})** to ${ctx.channels.get(channelId)!.mention}?`,
        title: 'Confirmation',
        thumbnail: {
          url: SteamUtil.URLS.Icon(app.id, app.icon),
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
      () => ctx.error(`Cancelled watcher for **${app!.name} (${app!.type})** on ${ctx.channels.get(channelId)!.mention}.`, {
        thumbnail: {
          url: SteamUtil.URLS.Icon(app!.id, app!.icon),
        },
      }),
      DEFAULT_COMPONENT_EXPIRATION,
    );

    return ctx.registerComponent(
      'confirm',
      async () => {
        ctx.unregisterComponent('confirm');

        let error = await WatchersCommand.hasReachedMaxWatchers(ctx.guildID!);

        if (error) {
          return ctx.error(error);
        }

        let workshopId = null;

        if (watcherType === WatcherType.WorkshopNew || watcherType === WatcherType.WorkshopUpdate) {
          const { total } = await steamClient.queryFiles(
            appId,
            watcherType === WatcherType.WorkshopNew
              ? EPublishedFileQueryType.RankedByPublicationDate
              : EPublishedFileQueryType.RankedByLastUpdatedDate,
            filetype!,
          );

          if (!total) {
            return ctx.error(
              stripIndents`
                **${app.name}** doesn't have any submissions of type **${EPFIMFileType[filetype!]}**!
                If this is an error, please try again later.
              `,
            );
          }

          workshopId = await db.select('id')
            .from('app_workshop')
            .where({
              appId: 1,
              filetype: filetype!,
            })
            .first()
            .then((res) => res?.id);

          if (!workshopId) {
            [workshopId] = await db.insert({
              appId,
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

        if (watcherType === WatcherType.Price) {
          error = await WatchersCommand.setAppPrice(app, ctx.guildID!);
        }

        if (error) {
          return ctx.error(error);
        }

        const ids = await db.insert({
          appId: !workshopId ? appId : null,
          channelId,
          threadId,
          type: watcherType,
          workshopId,
          inactive: false,
        }).into('watcher');

        return ctx.success(`Added **${watcherType}** watcher (#${ids[0]}) for **${app!.name} (${app!.type})** to ${ctx.channels.get(channelId)!.mention}.`, {
          thumbnail: {
            url: SteamUtil.URLS.Icon(app!.id, app!.icon),
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
      query,
      thread_id: threadId,
      watcherType,
    }: AddTypeArguments,
  ) {
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
        description: `Would you like to add the watcher for **${group.name}** to ${ctx.channels.get(channelId)!.mention}?`,
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
      () => ctx.error(`Cancelled watcher for **${group!.name}** on ${ctx.channels.get(channelId)!.mention}.`, {
        thumbnail: {
          url: SteamUtil.URLS.GroupAvatar(group.avatar, 'medium'),
        },
      }),
      DEFAULT_COMPONENT_EXPIRATION,
    );

    return ctx.registerComponent(
      'confirm',
      async () => {
        ctx.unregisterComponent('confirm');

        let error = await WatchersCommand.hasReachedMaxWatchers(ctx.guildID!);

        if (error) {
          return ctx.error(error);
        }

        error = await WatchersCommand.setWebhook(channelId, ctx.guildID!);

        if (error) {
          return ctx.error(error);
        }

        const ids = await db.insert({
          groupId: group!.id,
          channelId,
          threadId,
          type: watcherType,
          inactive: false,
        }).into('watcher');

        return ctx.success(`Added **${watcherType}** watcher (#${ids[0]}) for **${group!.name}** to ${ctx.channels.get(channelId)!.mention}.`, {
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
      query,
      thread_id: threadId,
    }: BaseArguments,
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
        description: `Would you like to add the watcher for **${ugc.name}** to ${ctx.channels.get(channelId)!.mention}?`,
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
      () => ctx.error(`Cancelled watcher for **${ugc!.name}** on ${ctx.channels.get(channelId)!.mention}.`, {
        thumbnail: {
          url: SteamUtil.URLS.Icon(app!.id, app!.icon),
        },
      }),
      DEFAULT_COMPONENT_EXPIRATION,
    );

    return ctx.registerComponent(
      'confirm',
      async () => {
        ctx.unregisterComponent('confirm');

        let error = await WatchersCommand.hasReachedMaxWatchers(ctx.guildID!);

        if (error) {
          return ctx.error(error);
        }

        error = await WatchersCommand.setWebhook(channelId, ctx.guildID!);

        if (error) {
          return ctx.error(error);
        }

        const ids = await db.insert({
          ugcId: ugc!.id,
          channelId,
          threadId,
          type: WatcherType.UGC,
          inactive: false,
        }).into('watcher');

        return ctx.success(`Added **${WatcherType.UGC}** watcher (#${ids[0]}) for **${ugc!.name}** to ${ctx.channels.get(channelId)!.mention}.`, {
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
          WHEN group_id IS NOT NULL THEN \`group\`.name
          WHEN ugc_id IS NOT NULL THEN CONCAT(ugc.name, ' (', app.name, ')')
          ELSE app.name
        END AS name
      `),
      'app_workshop.filetype',
      'watcher.*',
    ).from('watcher')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
      .leftJoin('app_workshop', 'app_workshop.id', 'watcher.workshop_id')
      .leftJoin('`group`', '`group`.id', 'watcher.group_id')
      .leftJoin('ugc', 'ugc.id', 'watcher.ugc_id')
      .leftJoin('app', (builder) => builder.on('app.id', 'watcher.app_id')
        .orOn('app.id', 'app_workshop.app_id')
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
        w.appId || w.groupId || w.ugcId,
        w.name,
        channelNames.get(w.channelId),
        oneLine`
          ${w.type}
          ${(w.workshopId ? `(${EPFIMFileType[w.filetype]})` : '')}
        `,
        !w.inactive ? 'X' : '',
      ])),
    ], {
      align: ['r', 'r', 'r', 'r', 'r', 'c'],
    })}\`\`\``;

    for (let i = 0; i < watchers.length; i += 1) {
      const watcher = watchers[i];

      if (!channelNames.has(watcher.channelId)) {
        // eslint-disable-next-line no-await-in-loop
        channelNames.set(watcher.channelId, await DiscordAPI.getChannelName(watcher.channelId));
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
          WHEN group_id IS NOT NULL THEN \`group\`.name
          WHEN ugc_id IS NOT NULL THEN ugc.name
          ELSE app.name
        END AS name
      `),
    ).from('watcher')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
      .leftJoin('`group`', '`group`.id', 'watcher.group_id')
      .leftJoin('ugc', 'ugc.id', 'watcher.ugc_id')
      .leftJoin('app', (builder) => builder.on('app.id', 'watcher.app_id')
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

    return ctx.success(`Removed watcher (#${watcherId}) for **${watcher.name}** from <#${watcher.channelId}>!`, {
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

  private static async setAppPrice(app: App, guildId: string) {
    const appPrice = await db.select(
      'app_price.id',
      'guild.currency_id',
      'currency.code',
      'currency.country_code',
    ).from('guild')
      .innerJoin('currency', 'currency.id', 'guild.currency_id')
      .leftJoin('app_price', (builder) => builder.on('app_price.app_id', app.id.toString())
        .andOn('app_price.currency_id', 'currency.id'))
      .where('guild.id', guildId)
      .first();

    // Don't have the app <> currency combination in the db
    if (!appPrice.id) {
      const priceOverview = await SteamAPI.getAppPrices(
        [app.id],
        appPrice.countryCode,
      );

      if (priceOverview === null) {
        return 'Something went wrong whilst fetching app prices! Please try again later.';
      }

      if (!priceOverview[app.id]!.success) {
        return stripIndents`
          ${oneLine`
            Unable to watch app prices for **${app.name} (${app.type})**
            in **${appPrice.code}**!`}
          This may be due to regional restrictions.
          You can change your currency using \`/currency\`
        `;
      }
      if (!priceOverview[app.id]!.data.price_overview) {
        return stripIndents`
          ${oneLine`
            Unable to watch app prices for **${app.name} (${app.type})**
            in **${appPrice.code}**!`}
          App is either free or doesn't have a (regional) price assigned.
        `;
      }

      await db.insert({
        appId: app.id,
        currencyId: appPrice.currencyId,
        price: priceOverview[app.id]!.data.price_overview!.initial,
        discountedPrice: priceOverview[app.id]!.data.price_overview!.final,
        discount: priceOverview[app.id]!.data.price_overview!.discount_percent,
      }).into('app_price');
    }

    return null;
  }
}
