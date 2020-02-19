import { oneLine, stripIndents } from 'common-tags';
import { GuildChannel, TextChannel } from 'discord.js';
import { CommandMessage } from 'discord.js-commando';
import db from '../../../db';
import env from '../../../env';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import SteamWatchClient from '../../structures/SteamWatchClient';
import WebApi from '../../../steam/WebApi';
import { EMBED_COLOURS } from '../../../utils/constants';
import { insertEmoji, capitalize } from '../../../utils/templateTags';

const WATCHER_TYPE = {
  ALL: 'all',
  NEWS: 'news',
  PRICE: 'price',
};

const PERMITTED_APP_TYPES: { [key: string]: string[]; } = {
  news: ['application', 'game'],
  price: ['application', 'dlc', 'game', 'music', 'video'],
};

export default class WatchCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'watch',
      group: 'apps',
      memberName: 'watch',
      description: 'Add a watcher for a Steam app.',
      details: stripIndents`
        Default \`channel\` is the channel the command is run in.
        You can also pass the store page or steamcommunity url as app id.
      `,
      examples: [
        'watch news 730',
        'watch price 271590 196820438398140417',
        'watch all 359550 #general',
      ],
      format: '<"all" | "price" | "news"> <app id> [channel]',
      guildOnly: true,
      // @ts-ignore Missing typings
      clientPermissions: ['MANAGE_WEBHOOKS'],
      // @ts-ignore Missing typings
      userPermissions: ['MANAGE_CHANNELS'],
      argsPromptLimit: 0,
      args: [
        {
          key: 'watcherType',
          prompt: 'Watcher type',
          type: 'string',
          // @ts-ignore Missing typings
          oneOf: Object.values(WATCHER_TYPE),
        },
        {
          key: 'appId',
          prompt: 'App identifier',
          type: 'integer',
        },
        {
          key: 'channel',
          prompt: 'Channel',
          type: 'channel',
          default: (msg: CommandMessage) => msg.channel,
        },
      ],
      throttling: {
        duration: 5,
        usages: 1,
      },
    });
  }

  async run(
    message: CommandMessage,
    { watcherType, appId, channel }: { watcherType: string, appId: number, channel: GuildChannel },
  ) {
    if (!(channel instanceof TextChannel)) {
      return message.embed({
        color: EMBED_COLOURS.ERROR,
        description: insertEmoji`:ERROR: ${channel} isn't a text channel!`,
      });
    }

    const types = watcherType.toLowerCase() === WATCHER_TYPE.ALL
      ? Object.values(WATCHER_TYPE).filter((type) => type !== WATCHER_TYPE.ALL)
      : [watcherType.toLowerCase()];

    // Check whether a watcher already exists for the app <> channel combination
    const existingWatcher = await db.select('app.*', 'watch_news', 'watch_price')
      .from('app_watcher')
      .innerJoin('app', 'app.id', 'app_watcher.app_id')
      .where({
        appId,
        channelId: channel.id,
        guildId: message.guild.id,
      })
      .first();

    const existingType = existingWatcher
      && ((existingWatcher.watchNews
        && types.includes(WATCHER_TYPE.NEWS)
        && WATCHER_TYPE.NEWS)
        || (existingWatcher.watchPrice
          && types.includes(WATCHER_TYPE.PRICE)
          && WATCHER_TYPE.PRICE));

    if (existingType) {
      return message.embed({
        color: EMBED_COLOURS.ERROR,
        description: insertEmoji(oneLine)`
          :ERROR: Already added a ${existingType} watcher for **${appId}**
          to ${channel}>!
        `,
      });
    }

    const app: any = {};

    if (!existingWatcher) {
      // Check whether the guild has reached the max amount of watchers
      const watchedCount = await db.count('* AS count')
        .from('app_watcher')
        .where('guild_id', message.guild.id)
        .first()
        .then((result: any) => result.count);

      if (watchedCount >= env.settings.maxWatchersPerGuild) {
        return message.embed({
          color: EMBED_COLOURS.ERROR,
          description: insertEmoji(oneLine)`
            :ERROR: Reached the maximum amount of watchers
            [${watchedCount}/${env.settings.maxWatchersPerGuild}]!
          `,
        });
      }

      // Ensure we're connected to Steam
      if (!this.client.steam.isAvailable) {
        return message.embed({
          color: EMBED_COLOURS.ERROR,
          description: insertEmoji(stripIndents)`
            :ERROR: Steam connection unavailable!
            Please try again later.
          `,
        });
      }

      const appInfo = await this.client.steam.getAppInfoAsync(appId);

      // App doesn't exist
      if (!appInfo) {
        return message.embed({
          color: EMBED_COLOURS.ERROR,
          description: insertEmoji(stripIndents)`
            :ERROR: Unable to find an app with the id **${appId}**!
            Make sure the id doesn't belong to a package or bundle.
          `,
        });
      }

      app.id = appInfo.appid;
      app.name = appInfo.details.name;
      app.icon = appInfo.details.clienticon;
      app.type = appInfo.details.type;
    }

    // Ensure the app <> type combination is valid
    for (let i = 0; i < types.length; i += 1) {
      const type = types[i];
      if (!PERMITTED_APP_TYPES[type].includes(app.type.toLowerCase())) {
        return message.embed({
          color: EMBED_COLOURS.ERROR,
          description: insertEmoji(oneLine)`
            :ERROR: ${capitalize(type)}
            watchers aren't supported for apps of type **${app.type}**!
          `,
        });
      }
    }

    if (app) {
      await db.insert(app)
        .into('app');
    }

    if (types.includes(WATCHER_TYPE.PRICE)) {
      const error = await WatchCommand.setAppPrice(app, message.guild.id);

      if (error) {
        return message.embed({
          color: EMBED_COLOURS.ERROR,
          description: error,
        });
      }
    }

    const error = await this.setWebhook(channel);

    if (error) {
      return message.embed({
        color: EMBED_COLOURS.ERROR,
        description: error,
      });
    }

    if (existingWatcher) {
      await db('app_watcher')
        .update({
          watchNews: types.includes(WATCHER_TYPE.NEWS) || existingWatcher.watchNews,
          watchPrice: types.includes(WATCHER_TYPE.PRICE) || existingWatcher.watchPrice,
        })
        .where({
          appId,
          channelId: channel.id,
          guildId: message.guild.id,
        });
    } else {
      await db.insert({
        appId,
        channelId: channel.id,
        guildId: message.guild.id,
        watchNews: types.includes(WATCHER_TYPE.NEWS),
        watchPrice: types.includes(WATCHER_TYPE.PRICE),
      }).into('app_watcher');
    }

    return message.embed({
      color: EMBED_COLOURS.SUCCESS,
      description: insertEmoji(oneLine)`
        :SUCCESS: ${(existingWatcher ? 'Updated' : 'Added')} watcher for
        **${app.name} (${app.type})**
        ${(existingWatcher ? 'in' : 'to')} ${channel}.
      `,
    });
  }

  private async setWebhook(channel: TextChannel) {
    const dbWebhook = db.select('token')
      .from('channel')
      .where('id', channel.id)
      .first();

    if (dbWebhook) {
      return null;
    }

    const webhooks = await channel.fetchWebhooks();

    if (webhooks.size >= 10) {
      return insertEmoji(stripIndents)`
        :ERROR: ${channel} already has the maximum amount of webhooks.
        Please remove any unused webhooks and try again.
      `;
    }

    const webhook = await channel.createWebhook(
      this.client.user.username,
      this.client.user.avatarURL,
      'Required by SteamWatch',
    );

    await db.insert({
      id: channel.id,
      guildId: channel.guild.id,
      webhookToken: webhook.token,
    }).into('channel');

    return null;
  }

  private static async setAppPrice(app: any, guildId: string) {
    const appPrice = await db.select(
      'app_price.id',
      { currencyId: 'currency.id' },
      { currencyAbbr: 'currency.abbreviation' },
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
      const priceOverview = await WebApi.GetAppPricesAsync(
        [app.id],
        appPrice.countryCode,
      );

      if (!priceOverview[app.id].success) {
        return insertEmoji(stripIndents)`
          ${oneLine`
            :ERROR: Unable to watch app prices for **${app.name} (${app.type})**
            in **${appPrice.currencyAbbr}**!`}
          This may be due to regional restrictions.
          ${oneLine`
            You can change your currency using
            \`${this.usage('currency')} <currency>\``}
        `;
      }
      if (!priceOverview[app.id].data.price_overview) {
        return insertEmoji(stripIndents)`
          :ERROR: Unable to watch app prices for **${app.name} (${app.type})** in **${appPrice.currencyAbbr}**!
          Free apps cannot be watched for price changes!
        `;
      }

      await db.insert({
        appId: app.id,
        currencyId: appPrice.currencyId,
        price: priceOverview[app.id].data.price_overview.initial,
        discountedPrice: priceOverview[app.id].data.price_overview.initial,
      }).into('app_price');
    }

    return null;
  }
}
