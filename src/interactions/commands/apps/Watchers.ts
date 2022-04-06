import { oneLine, stripIndents } from 'common-tags';
import { RESTGetAPIChannelWebhooksResult, RESTPostAPIChannelWebhookResult, Routes } from 'discord-api-types/v9';
import {
  AutocompleteContext,
  ButtonStyle,
  ChannelType,
  CommandContext,
  CommandOptionType,
  ComponentType,
  SlashCreator,
} from 'slash-create';
import GuildOnlyCommand from '../../GuildOnlyCommand';
import db from '../../../db';
import { App, UGC } from '../../../db/knex';
import SteamAPI from '../../../steam/SteamAPI';
import SteamUtil from '../../../steam/SteamUtil';
import { WatcherType } from '../../../types';
import { EMBED_COLOURS, PERMITTED_APP_TYPES } from '../../../utils/constants';
import DiscordAPI from '../../../utils/DiscordAPI';
import env from '../../../utils/env';
import Util from '../../../utils/Util';

const markdownTable = require('markdown-table');

const WATCHERS_PER_TABLE = 15;

interface BaseArguments {
  channel: string;
}

interface BaseAddArguments extends BaseArguments {
  query: string;
}

interface AddAppArguments extends BaseAddArguments {
  watcher_type: WatcherType;
}

type AddUGCArguments = BaseAddArguments;

interface AddArguments {
  app: AddAppArguments;
  ugc: AddUGCArguments;
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
      guildIDs: env.dev ? [env.devGuildId] : undefined,
      options: [{
        type: CommandOptionType.SUB_COMMAND_GROUP,
        name: 'add',
        description: 'Add a watcher for a Steam item.',
        options: [{
          type: CommandOptionType.SUB_COMMAND,
          name: 'app',
          description: 'Watch a Steam app (game, dlc, etc.)',
          options: [{
            type: CommandOptionType.STRING,
            name: 'watcher_type',
            description: 'The application property(s) that should be watched for changes',
            required: true,
            choices: [{
              name: 'News',
              value: WatcherType.NEWS,
            }, {
              name: 'Price',
              value: WatcherType.PRICE,
            }, {
              name: 'Workshop',
              value: WatcherType.WORKSHOP,
            }],
          }, {
            type: CommandOptionType.STRING,
            name: 'query',
            description: 'Search term or app id',
            autocomplete: true,
            required: true,
          }, {
            type: CommandOptionType.CHANNEL,
            name: 'channel',
            description: 'The channel notifications should be sent to',
            required: true,
            channel_types: [ChannelType.GUILD_NEWS, ChannelType.GUILD_TEXT],
          }],
        }, {
          type: CommandOptionType.SUB_COMMAND,
          name: 'ugc',
          description: 'Watch a workshop item/user-generated content',
          options: [{
            type: CommandOptionType.STRING,
            name: 'query',
            description: 'UGC url or item id',
            required: true,
          }, {
            type: CommandOptionType.CHANNEL,
            name: 'channel',
            description: 'The channel notifications should be sent to',
            required: true,
            channel_types: [ChannelType.GUILD_NEWS, ChannelType.GUILD_TEXT],
          }],
        }],
      }, {
        type: CommandOptionType.SUB_COMMAND,
        name: 'list',
        description: 'List app watchers.',
        options: [{
          type: CommandOptionType.CHANNEL,
          name: 'channel',
          description: 'The channel notifications are being sent to',
          channel_types: [ChannelType.GUILD_NEWS, ChannelType.GUILD_TEXT],
        }],
      }, {
        type: CommandOptionType.SUB_COMMAND,
        name: 'remove',
        description: 'Remove a watcher.',
        options: [{
          type: CommandOptionType.STRING,
          name: 'watcher_id',
          description: 'The watcher\'s id',
          autocomplete: true,
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
  async autocomplete(ctx: AutocompleteContext) {
    if (!ctx.guildID) {
      return ctx.sendResults([]);
    }

    if (ctx.focused === 'watcher_id') {
      const value = ctx.options[ctx.subcommands[0]][ctx.focused];

      return ctx.sendResults(await GuildOnlyCommand.createWatcherAutocomplete(value, ctx.guildID!));
    }

    const value = ctx.options[ctx.subcommands[0]][ctx.subcommands[1]][ctx.focused];

    return ctx.sendResults(await SteamUtil.createAppAutocomplete(value));
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
      // Check whether the guild has reached the max amount of watchers
      const watchedCount = await db.count('* AS count')
        .from('watcher')
        .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
        .where('guild_id', ctx.guildID!)
        .first()
        .then((res: any) => parseInt(res.count, 10));

      if (watchedCount >= env.settings.maxWatchersPerGuild) {
        return ctx.error(oneLine`
          Reached the maximum amount of watchers
          [${watchedCount}/${env.settings.maxWatchersPerGuild}]!
        `);
      }

      if (add.app) {
        return WatchersCommand.addApp(ctx, add.app);
      }

      if (add.ugc) {
        return WatchersCommand.addUGC(ctx, add.ugc);
      }
    }

    if (list) {
      return WatchersCommand.list(ctx, list);
    }

    return WatchersCommand.remove(ctx, remove!);
  }

  private static async addApp(
    ctx: CommandContext,
    { channel: channelId, query: name, watcher_type: watcherType }: AddAppArguments,
  ) {
    const appId = await SteamUtil.findAppId(name);

    if (!appId) {
      return ctx.error(`Unable to find an application with the id/name: ${name}`);
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

    if (!PERMITTED_APP_TYPES[watcherType].includes(app.type.toLowerCase())) {
      return ctx.error(`${Util.capitalize(watcherType)} watchers aren't supported for apps of type **${app.type}**!`);
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

    ctx.registerComponent('cancel', () => ctx.error(`Cancelled watcher for **${app!.name} (${app!.type})** on ${ctx.channels.get(channelId)!.mention}.`, {
      thumbnail: {
        url: SteamUtil.URLS.Icon(app!.id, app!.icon),
      },
    }));

    return ctx.registerComponent('confirm', async () => {
      let error = await WatchersCommand.setWebhook(channelId, ctx.guildID!);

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
        type: watcherType,
      }).into('watcher');

      return ctx.success(`Added watcher (#${ids[0]}) for **${app!.name} (${app!.type})** to ${ctx.channels.get(channelId)!.mention}.`, {
        thumbnail: {
          url: SteamUtil.URLS.Icon(app!.id, app!.icon),
        },
      });
    });
  }

  private static async addUGC(ctx: CommandContext, { channel: channelId, query }: AddUGCArguments) {
    const ugcId = SteamUtil.findUGCId(query);

    if (!ugcId) {
      return ctx.error(`Unable to parse UGC identifier: ${query}`);
    }

    let ugc: UGC | undefined;

    try {
      ugc = (await db.select('*')
        .from('ugc')
        .where('id', ugcId)
        .first()) || (await SteamUtil.persistUGC(ugcId));
    } catch (err) {
      return ctx.error(`Unable to add watcher for UGC! ${(err as Error).message}`);
    }

    if (!ugc) {
      return ctx.error(`Unable to find UGC with the id **${ugcId}**!`);
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

    ctx.registerComponent('cancel', () => ctx.error(`Cancelled watcher for **${ugc!.name}** on ${ctx.channels.get(channelId)!.mention}.`, {
      thumbnail: {
        url: SteamUtil.URLS.Icon(app!.id, app!.icon),
      },
    }));

    return ctx.registerComponent('confirm', async () => {
      const error = await WatchersCommand.setWebhook(channelId, ctx.guildID!);

      if (error) {
        return ctx.error(error);
      }

      const ids = await db.insert({
        appId: ugc!.appId,
        ugcId: ugc!.id,
        channelId,
        type: WatcherType.UGC,
      }).into('watcher');

      return ctx.success(`Added watcher (#${ids[0]}) for **${ugc!.name}** to ${ctx.channels.get(channelId)!.mention}.`, {
        thumbnail: {
          url: SteamUtil.URLS.Icon(app!.id, app!.icon),
        },
      });
    });
  }

  private static async list(ctx: CommandContext, { channel: channelId }: ListArguments) {
    let dbQuery = db.select({ appName: 'app.name' }, { ugcName: 'ugc.name' }, 'watcher.*')
      .from('app')
      .innerJoin('watcher', 'app.id', 'watcher.app_id')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
      .leftJoin('ugc', 'ugc.id', 'watcher.ugc_id')
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
          ['Id', 'App/UGC Id', 'Name', 'Channel', 'Type'],
          ...(await Promise.all(group.map(async (w: any) => {
            const channelName = await DiscordAPI.getChannelName(w.channelId);

            return [
              w.id,
              w.ugcId || w.appId,
              w.ugcName ? `${w.ugcName} (${w.appName})` : w.appName,
              channelName,
              w.type.replace('_', ' '),
            ];
          }))),
        ], {
          align: 'r',
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
      .innerJoin('app', 'app.id', 'watcher.app_id')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
      .leftJoin('ugc', 'ugc.id', 'watcher.ugc_id')
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
      await DiscordAPI.delete(Routes.webhook(watcher.webhookId));
    }

    return ctx.success(`Removed watcher (#${watcherId}) for **${watcher.ugcName || watcher.appName}** from <#${watcher.channelId}>!`, {
      thumbnail: {
        url: SteamUtil.URLS.Icon(watcher.appId, watcher.icon),
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
