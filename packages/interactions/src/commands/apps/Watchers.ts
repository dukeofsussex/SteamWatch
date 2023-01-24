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
  EMBED_COLOURS,
  env,
  logger,
  PatreonUtils,
  SteamAPI,
  SteamUtil,
  STEAM_NEWS_APPID,
  UGC,
  WatcherType,
} from '@steamwatch/shared';
import GuildOnlyCommand from '../../GuildOnlyCommand';

const markdownTable = require('markdown-table');

const WATCHERS_PER_TABLE = 15;

interface BaseArguments {
  query: string;
  channel: string;
  thread_id?: string;
}

interface AddArguments {
  news: BaseArguments;
  price: BaseArguments;
  steam: Pick<BaseArguments, 'channel' | 'thread_id'>;
  ugc: BaseArguments;
  workshop: BaseArguments;
}

interface AddAppArguments extends BaseArguments {
  watcher_type: WatcherType
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
          description: 'Watch a Steam app\'s workshop for new submissions',
          options: [
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

      if (add.news) {
        return WatchersCommand.addApp(ctx, {
          ...add.news,
          watcher_type: WatcherType.NEWS,
        });
      }

      if (add.price) {
        return WatchersCommand.addApp(ctx, {
          ...add.price,
          watcher_type: WatcherType.PRICE,
        });
      }

      if (add.steam) {
        return WatchersCommand.addApp(ctx, {
          channel: add.steam.channel,
          query: STEAM_NEWS_APPID.toString(),
          watcher_type: WatcherType.NEWS,
        });
      }

      if (add.ugc) {
        return WatchersCommand.addUGC(ctx, add.ugc);
      }

      if (add.workshop) {
        return WatchersCommand.addApp(ctx, {
          ...add.workshop,
          watcher_type: WatcherType.WORKSHOP,
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
      watcher_type: watcherType,
      thread_id: threadId,
    }: AddAppArguments,
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
        let error = await WatchersCommand.hasReachedMaxWatchers(ctx.guildID!);

        if (error) {
          return ctx.error(error);
        }

        error = await WatchersCommand.setWebhook(channelId, ctx.guildID!);

        if (error) {
          return ctx.error(error);
        }

        if (watcherType === WatcherType.PRICE) {
          error = await WatchersCommand.setAppPrice(app, ctx.guildID!);
        }

        if (error) {
          return ctx.error(error);
        }

        const ids = await db.insert({
          appId,
          channelId,
          threadId,
          type: watcherType,
        }).into('watcher');

        return ctx.success(`Added watcher (#${ids[0]}) for **${app!.name} (${app!.type})** to ${ctx.channels.get(channelId)!.mention}.`, {
          thumbnail: {
            url: SteamUtil.URLS.Icon(app!.id, app!.icon),
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
        }).into('watcher');

        return ctx.success(`Added watcher (#${ids[0]}) for **${ugc!.name}** to ${ctx.channels.get(channelId)!.mention}.`, {
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
    let dbQuery = db.select({ appName: 'app.name' }, { ugcName: 'ugc.name' }, 'watcher.*')
      .from('watcher')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
      .leftJoin('ugc', 'ugc.id', 'watcher.ugc_id')
      .leftJoin('app', (builder) => builder.on('app.id', 'watcher.app_id')
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

    /* eslint-disable no-param-reassign */
    const grouped = watchers.reduce((prev, curr, idx) => {
      const index = Math.floor(idx / WATCHERS_PER_TABLE);
      (prev[index] = prev[index] || []).push(curr);
      return prev;
    }, []);
    /* eslint-enable no-param-reassign */

    /* eslint-disable no-await-in-loop */
    for (let i = 0; i < grouped.length; i += 1) {
      const group = grouped[i];
      await ctx.send({
        content: `\`\`\`md\n${markdownTable([
          ['Id', 'App/UGC Id', 'Name', 'Channel', 'Type', 'Active'],
          ...(await Promise.all(group.map(async (w: any) => {
            const channelName = await DiscordAPI.getChannelName(w.channelId);

            return [
              w.id,
              w.ugcId || w.appId,
              w.ugcName ? `${w.ugcName} (${w.appName})` : w.appName,
              channelName,
              w.type,
              !w.inactive ? 'X' : '',
            ];
          }))),
        ], {
          align: ['r', 'r', 'r', 'r', 'r', 'c'],
        })}\`\`\``,
      });
    }
    /* eslint-enable no-await-in-loop */
  }

  private static async remove(ctx: CommandContext, { watcher_id: watcherId }: RemoveArguments) {
    const watcher = await db.select(
      'watcher.id',
      'watcher.app_id',
      { appName: 'app.name' },
      { ugcName: 'ugc.name' },
      'icon',
      'channel_id',
      'webhook_id',
      'webhook_token',
    ).from('watcher')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
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

    return ctx.success(`Removed watcher (#${watcherId}) for **${watcher.ugcName || watcher.appName}** from <#${watcher.channelId}>!`, {
      thumbnail: {
        url: SteamUtil.URLS.Icon(watcher.appId, watcher.icon),
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
        ${channelId} already has the maximum amount of webhooks.
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
      .leftJoin('app_price', function appPriceLeftJoin() {
        this.on('app_price.app_id', '=', app.id.toString())
          .andOn('app_price.currency_id', '=', 'currency.id');
      })
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
