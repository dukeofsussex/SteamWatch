import { oneLine, stripIndents } from 'common-tags';
import { GuildChannel, TextChannel } from 'discord.js';
import { CommandoMessage } from 'discord.js-commando';
import SteamWatchClient from '../../structures/SteamWatchClient';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import db from '../../../db';
import env from '../../../env';
import WebApi from '../../../steam/WebApi';
import { EMBED_COLOURS } from '../../../utils/constants';
import { capitalize, insertEmoji } from '../../../utils/templateTags';

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
      clientPermissions: ['MANAGE_WEBHOOKS'],
      userPermissions: ['MANAGE_CHANNELS'],
      argsPromptLimit: 0,
      args: [
        {
          key: 'watcherType',
          prompt: 'Watcher type',
          type: 'string',
          oneOf: Object.values(WATCHER_TYPE),
        },
        {
          key: 'appId',
          prompt: 'App identifier',
          type: 'app-id',
        },
        {
          key: 'channel',
          prompt: 'Channel',
          type: 'channel',
          default: (msg: CommandoMessage) => msg.channel,
        },
      ],
      throttling: {
        duration: 5,
        usages: 1,
      },
    });
  }

  async run(
    message: CommandoMessage,
    { watcherType, appId, channel }: { watcherType: string, appId: number, channel: GuildChannel },
  ) {
    if (!(channel instanceof TextChannel)) {
      return message.embed({
        color: EMBED_COLOURS.ERROR,
        description: insertEmoji`:ERROR: **${channel}** isn't a text channel!`,
      });
    }

    const types = watcherType.toLowerCase() === WATCHER_TYPE.ALL
      ? Object.values(WATCHER_TYPE).filter((type) => type !== WATCHER_TYPE.ALL)
      : [watcherType.toLowerCase()];

    // Check whether the guild has reached the max amount of watchers
    const watchedCount = await db.count('* AS count')
      .from('app_watcher')
      .where('guild_id', message.guild.id)
      .first()
      .then((res: any) => parseInt(res.count, 10));

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

    let app = await db.select('*')
      .from('app')
      .where('id', appId)
      .first();

    if (!app) {
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

      app = {
        id: appInfo.appid,
        name: appInfo.details.name,
        icon: appInfo.details.icon,
        type: capitalize(appInfo.details.type),
      };
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

    if (app.lastCheckedNews === undefined) {
      await db.insert(app)
        .into('app');
    }

    let error = await WatchCommand.setWebhookAsync(channel);

    if (!error && types.includes(WATCHER_TYPE.PRICE)) {
      error = await WatchCommand.setAppPriceAsync(app, message.guild.id);
    }

    if (error) {
      return message.embed({
        color: EMBED_COLOURS.ERROR,
        description: error,
      });
    }

    await db.insert({
      appId,
      channelId: channel.id,
      guildId: message.guild.id,
      watchNews: types.includes(WATCHER_TYPE.NEWS),
      watchPrice: types.includes(WATCHER_TYPE.PRICE),
    }).into('app_watcher');

    return message.embed({
      color: EMBED_COLOURS.SUCCESS,
      description: insertEmoji(oneLine)`
        :SUCCESS: Added watcher for **${app.name} (${app.type})** to ${channel}.
      `,
      thumbnail: {
        url: WebApi.getIconUrl(app.id, app.icon),
      },
    });
  }

  private static async setWebhookAsync(channel: TextChannel) {
    const dbWebhook = await db.select('id')
      .from('channel_webhook')
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
      channel.client.user!.username,
      {
        avatar: channel.client.user!.displayAvatarURL(),
        reason: 'Required by SteamWatch',
      },
    );

    await db.insert({
      id: channel.id,
      guildId: channel.guild.id,
      webhookId: webhook.id,
      webhookToken: webhook.token,
    }).into('channel_webhook');

    return null;
  }

  private static async setAppPriceAsync(app: any, guildId: string) {
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
      const priceOverview = await WebApi.getAppPricesAsync(
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
          ${oneLine`
            :ERROR: Unable to watch app prices for **${app.name} (${app.type})**
            in **${appPrice.currencyAbbr}**!`}
          App is either free or doesn't have a (regional) price assigned.
        `;
      }

      await db.insert({
        appId: app.id,
        currencyId: appPrice.currencyId,
        price: priceOverview[app.id].data.price_overview.initial,
        formattedPrice: priceOverview[app.id].data.price_overview.initial_formatted
          || priceOverview[app.id].data.price_overview.final_formatted,
        discountedPrice: priceOverview[app.id].data.price_overview.final,
        formattedDiscountedPrice: priceOverview[app.id].data.price_overview.final_formatted,
        discount: priceOverview[app.id].data.price_overview.discount_percent,
      }).into('app_price');
    }

    return null;
  }
}
