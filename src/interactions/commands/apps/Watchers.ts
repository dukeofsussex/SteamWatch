import { oneLine, stripIndents } from 'common-tags';
import {
  RESTGetAPIChannelResult,
  RESTGetAPIChannelWebhooksResult,
  RESTPostAPIChannelWebhookResult,
  Routes,
} from 'discord-api-types/v9';
import {
  ButtonStyle,
  ChannelType,
  CommandContext,
  CommandOptionType,
  ComponentType,
  SlashCreator,
} from 'slash-create';
import { DiscordAPIError } from '@discordjs/rest';
import GuildOnlyCommand from '../../GuildOnlyCommand';
import db from '../../../db';
import SteamAPI from '../../../steam/SteamAPI';
import steamUser from '../../../steam/SteamUser';
import { SteamUtil } from '../../../steam/SteamUtil';
import {
  DISCORD_ERROR_CODES,
  EMBED_COLOURS,
  PERMITTED_APP_TYPES,
  WatcherType,
} from '../../../utils/constants';
import DiscordAPI from '../../../utils/DiscordAPI';
import env from '../../../utils/env';
import Util from '../../../utils/Util';

const markdownTable = require('markdown-table');

interface AddArguments {
  watcher_type: WatcherType;
  query: string;
  channel: string;
}

interface ListArguments {
  query?: string;
  channel?: string;
}

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
      guildIDs: env.dev ? [env.devGuildId] : undefined,
      options: [{
        type: CommandOptionType.SUB_COMMAND,
        name: 'add',
        description: 'Add a watcher for a Steam app.',
        options: [{
          type: CommandOptionType.STRING,
          name: 'watcher_type',
          description: 'The application attribute(s) that should be watched for changes',
          required: true,
          choices: [{
            name: 'All',
            value: WatcherType.ALL,
          },
          {
            name: 'News',
            value: WatcherType.NEWS,
          }, {
            name: 'Price',
            value: WatcherType.PRICE,
          }],
        }, {
          type: CommandOptionType.STRING,
          name: 'query',
          description: 'Search term or app id',
          required: true,
        }, {
          type: CommandOptionType.CHANNEL,
          name: 'channel',
          description: 'The channel notifications should be sent to',
          required: true,
          channel_types: [ChannelType.GUILD_TEXT],
        }],
      }, {
        type: CommandOptionType.SUB_COMMAND,
        name: 'list',
        description: 'List app watchers.',
        options: [{
          type: CommandOptionType.STRING,
          name: 'query',
          description: 'Search term or app id',
        }, {
          type: CommandOptionType.CHANNEL,
          name: 'channel',
          description: 'The channel notifications are being sent to',
          channel_types: [ChannelType.GUILD_TEXT],
        }],
      }, {
        type: CommandOptionType.SUB_COMMAND,
        name: 'remove',
        description: 'Remove a watcher.',
        options: [{
          type: CommandOptionType.NUMBER,
          name: 'watcher_id',
          description: 'The watcher\'s id',
          required: true,
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
  async run(ctx: CommandContext) {
    try {
      await GuildOnlyCommand.setupGuild(ctx);
    } catch {
      return null;
    }

    const { add, list, remove } = ctx.options as CommandArguments;

    if (add) {
      return this.add(ctx, add);
    }

    if (list) {
      return this.list(ctx, list);
    }

    return this.remove(ctx, remove!);
  }

  // eslint-disable-next-line class-methods-use-this
  async add(
    ctx: CommandContext,
    { channel: channelId, query: name, watcher_type: watcherType }: AddArguments,
  ) {
    // Check whether the guild has reached the max amount of watchers
    const watchedCount = await db.count('* AS count')
      .from('app_watcher')
      .where('guild_id', ctx.guildID)
      .first()
      .then((res: any) => parseInt(res.count, 10));

    if (watchedCount >= env.settings.maxWatchersPerGuild) {
      ctx.error(oneLine`
        Reached the maximum amount of watchers
        [${watchedCount}/${env.settings.maxWatchersPerGuild}]!
      `);
    }

    const appId = await SteamUtil.findAppId(name);

    if (!appId) {
      return ctx.error(`Unable to find an application with the id/name: ${name}`);
    }

    let app = await db.select('*')
      .from('app')
      .where('id', appId)
      .first();

    if (!app) {
      const appInfo = (await steamUser.getProductInfo([appId], [], true))
        .apps[appId]?.appinfo;

      // App doesn't exist
      if (!appInfo) {
        return ctx.error(stripIndents`
          Unable to find an app with the id **${appId}**!
          Make sure the id doesn't belong to a package or bundle.
        `);
      }

      app = {
        id: appId,
        name: appInfo.common.name,
        icon: appInfo.common.icon || '',
        type: Util.capitalize(appInfo.common.type),
        lastCheckedNews: undefined,
      };
    }

    const types = watcherType === WatcherType.ALL
      ? Object.values(WatcherType).filter((wt) => wt !== WatcherType.ALL)
      : [watcherType];

    // Ensure the app <> type combination is valid
    for (let i = 0; i < types.length; i += 1) {
      const type = types[i];
      if (!PERMITTED_APP_TYPES[type].includes(app.type.toLowerCase())) {
        return ctx.error(`${Util.capitalize(type)} watchers aren't supported for apps of type **${app.type}**!`);
      }
    }

    if (typeof app.lastCheckedNews === 'undefined') {
      await db.insert(app)
        .into('app');
    }

    await ctx.editOriginal({
      embeds: [{
        color: EMBED_COLOURS.PENDING,
        description: `Would you like to add the watcher for **${app.name} (${app.type})** to ${ctx.channels.get(channelId)!.mention}?`,
        title: 'Confirmation',
        thumbnail: {
          url: SteamUtil.getIconUrl(app.id, app.icon),
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

    ctx.registerComponent('cancel', () => ctx.error(`Cancelled watcher for **${app!.name} (${app!.type})** on ${ctx.channels.get(channelId)!.mention}.`, {
      thumbnail: {
        url: SteamUtil.getIconUrl(app!.id, app!.icon),
      },
    }));
    return ctx.registerComponent('confirm', async () => {
      let error = await WatchersCommand.setWebhook(channelId, ctx.guildID!);

      if (error) {
        return ctx.error(error);
      }

      if (types.includes(WatcherType.PRICE)) {
        error = await WatchersCommand.setAppPrice(app, ctx.guildID!);
      }

      if (error) {
        return ctx.error(error);
      }

      const ids = await db.insert({
        appId,
        channelId,
        guildId: ctx.guildID,
        watchNews: types.includes(WatcherType.NEWS),
        watchPrice: types.includes(WatcherType.PRICE),
      }).into('app_watcher');

      return ctx.success(`Added watcher (#${ids[0]}) for **${app!.name} (${app!.type})** to ${ctx.channels.get(channelId)!.mention}.`, {
        thumbnail: {
          url: SteamUtil.getIconUrl(app!.id, app!.icon),
        },
      });
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async list(ctx: CommandContext, { channel: channelId, query }: ListArguments) {
    let dbQuery = db.select('app.name', 'app_watcher.*')
      .from('app')
      .innerJoin('app_watcher', 'app.id', 'app_watcher.app_id')
      .where('guild_id', ctx.guildID);

    if (query) {
      const appId = await SteamUtil.findAppId(query);

      if (!appId) {
        return ctx.error(`Unable to find an application with the id/name: ${query}`);
      }

      dbQuery = dbQuery.andWhere('app_id', appId);
    }

    if (channelId) {
      dbQuery = dbQuery.andWhere('channel_id', channelId);
    }

    const watchers = await dbQuery.orderBy('name', 'asc');

    if (watchers.length === 0) {
      return ctx.error('No watchers found!');
    }

    return ctx.send({
      content: `\`\`\`md\n${markdownTable([
        ['Id', 'App Id', 'Name', 'Channel', 'Types'],
        ...(await Promise.all(watchers.map(async (w) => {
          let channelName: string;

          try {
            channelName = (
              await DiscordAPI.get(Routes.channel(w.channelId)) as RESTGetAPIChannelResult
            ).name!;
          } catch (err) {
            const error = err as DiscordAPIError;

            switch (error.code) {
              case DISCORD_ERROR_CODES.MISSING_ACCESS:
                channelName = '[hidden]';
                break;
              case DISCORD_ERROR_CODES.UNKNOWN_CHANNEL:
                channelName = '[deleted]';
                break;
              default:
                channelName = '[unknown]';
            }
          }

          return [
            w.id,
            w.appId,
            w.name,
            channelName,
            [w.watchNews ? 'News' : '', w.watchPrice ? 'Price' : ''].filter((type) => type).join(','),
          ];
        }))),
      ])}\`\`\``,
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async remove(ctx: CommandContext, { watcher_id: watcherId }: RemoveArguments) {
    const watcher = await db.select(
      'app_watcher.id',
      'app_watcher.app_id',
      'app.name',
      'icon',
      'channel_id',
      'webhook_id',
      'webhook_token',
    ).from('app_watcher')
      .innerJoin('app', 'app.id', 'app_watcher.app_id')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'app_watcher.channel_id')
      .where({
        'app_watcher.id': watcherId,
        'app_watcher.guild_id': ctx.guildID,
      })
      .first();

    if (!watcher) {
      return ctx.error(`Unable to find a watcher with the identifier **${watcherId}**!`);
    }

    await db.delete()
      .from('app_watcher')
      .where('id', watcher.id);

    const count = await db.count('* AS count')
      .from('app_watcher')
      .where('channel_id', watcher.channelId)
      .first()
      .then((res: any) => parseInt(res.count, 10));

    if (count === 0) {
      await db.delete()
        .from('channel_webhook')
        .where('id', watcher.channelId);
      await DiscordAPI.delete(Routes.webhook(watcher.webhookId));
    }

    return ctx.success(`Removed watcher (#${watcherId}) for **${watcher.name}** from <#${watcher.channelId}>!`, {
      thumbnail: {
        url: SteamUtil.getIconUrl(watcher.appId, watcher.icon),
      },
    });
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

  private static async setAppPrice(app: any, guildId: string) {
    const appPrice = await db.select(
      'app_price.id',
      'guild.currency_id',
      'currency.code',
      'currency.country_code',
    ).from('guild')
      .innerJoin('currency', 'currency.id', 'guild.currency_id')
      .leftJoin('app_price', function appPriceLeftJoin() {
        this.on('app_price.app_id', '=', app.id)
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

      if (!priceOverview[app.id].success) {
        return stripIndents`
          ${oneLine`
            Unable to watch app prices for **${app.name} (${app.type})**
            in **${appPrice.code}**!`}
          This may be due to regional restrictions.
          You can change your currency using \`/currency\`
        `;
      }
      if (!priceOverview[app.id].data.price_overview) {
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
        price: priceOverview[app.id].data.price_overview!.initial,
        discountedPrice: priceOverview[app.id].data.price_overview!.final,
        discount: priceOverview[app.id].data.price_overview!.discount_percent,
      }).into('app_price');
    }

    return null;
  }
}
