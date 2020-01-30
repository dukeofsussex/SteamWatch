import { oneLine, stripIndent } from 'common-tags';
import { Channel, GuildChannel } from 'discord.js';
import { CommandMessage } from 'discord.js-commando';
import db from '../../db';
import env from '../../env';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import SteamWatchClient from '../../structures/SteamWatchClient';
import WebApi from '../../steam/WebApi';
import { CURRENCIES, EMBED_COLOURS } from '../../utils/constants';
import { insertEmoji, capitalize } from '../../utils/templateTags';

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
      details: 'Default `channel` is the channel the command is run in.',
      examples: [
        'watch news 730',
        'watch price 271590 196820438398140417',
        'watch all 359550 #general',
      ],
      format: '<"all" | "price" | "news"> <app id> [channel]',
      guildOnly: true,
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
          default: -1,
        },
      ],
      throttling: {
        duration: 5,
        usages: 1,
      },
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async run(
    message: CommandMessage,
    { watcherType, appId, channel }: { watcherType: string, appId: number, channel: Channel },
  ) {
    const types = watcherType.toLowerCase() === WATCHER_TYPE.ALL
      ? Object.values(WATCHER_TYPE).filter((type) => type !== WATCHER_TYPE.ALL)
      : [watcherType.toLowerCase()];

    // Check whether the channel is valid
    if (channel instanceof GuildChannel && channel.type !== 'text') {
      return message.embed({
        color: EMBED_COLOURS.ERROR,
        description: insertEmoji`:ERROR: <#${channel.id}> isn't a text channel!`,
      });
    }

    const watcherChannelId = channel.id || message.channel.id;

    // Check whether a watcher already exists for the app <> channel combination
    const existingWatcher = await db.select('app_id', 'watch_news', 'watch_price')
      .from('app_watcher')
      .where({
        appId,
        channelId: watcherChannelId,
        guildId: message.guild.id,
      })
      .first();

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
    }

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
          to <#${watcherChannelId}>!
        `,
      });
    }

    // Fetch stored app details
    let app: any = await db.select('id', 'name', 'type')
      .from('app')
      .where('id', appId)
      .first();
    let newApp = false;

    // Nothing stored, fetch app details from Steam
    if (!app) {
      // @ts-ignore this.client is actually a SteamWatchClient
      app = await this.client.steam.getAppInfoAsync(appId);

      // App doesn't exist
      if (!app) {
        return message.embed({
          color: EMBED_COLOURS.ERROR,
          description: insertEmoji(stripIndent)`
            :ERROR: Unable to find an app with the id **${appId}**!
            Make sure the id doesn't belong to a package or bundle.
          `,
        });
      }

      app.name = app.details.name;
      app.type = app.details.type;

      newApp = true;
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

    if (newApp) {
      await db.insert({
        id: app.appid,
        name: app.name,
        type: app.type,
      }).into('app');
    }

    if (types.includes(WATCHER_TYPE.PRICE)) {
      const appPrice = await db.select(
        'app_price.id',
        { currencyId: 'currency.id' },
        { currencyAbbr: 'currency.abbreviation' },
      ).from('guild')
        .innerJoin('currency', 'currency.id', 'guild.currency_id')
        .leftJoin('app_price', function appPriceLeftJoin() {
          this.on('app_price.app_id', '=', appId.toString())
            .andOn('app_price.currency_id', '=', 'currency.id');
        })
        .where('guild.id', message.guild.id)
        .first();

      // Don't have the app <> currency combination in the db
      if (!appPrice.id) {
        const priceOverview = await WebApi.GetAppPricesAsync(
          [appId],
          CURRENCIES[appPrice.currencyAbbr].cc,
        );

        if (!priceOverview[appId].success) {
          return message.embed({
            color: EMBED_COLOURS.ERROR,
            description: insertEmoji(stripIndent)`
              ${oneLine`
                :ERROR: Unable to watch app prices for **${app.name} (${app.type})**
                in **${appPrice.currencyAbbr}**!`}
              This may be due to regional restrictions.
              ${oneLine`
                You can change your currency using
                \`${message.anyUsage('currency')} <currency>\``}
            `,
          });
        } if (!priceOverview[appId].data.price_overview) {
          return message.embed({
            color: EMBED_COLOURS.ERROR,
            description: insertEmoji(stripIndent)`
              :ERROR: Unable to watch app prices for **${app.name} (${app.type})** in **${appPrice.currencyAbbr}**!
              Free apps cannot be watched for price changes!
            `,
          });
        }

        await db.insert({
          appId,
          currencyId: appPrice.currencyId,
          price: priceOverview[appId].data.price_overview.initial,
          discountedPrice: priceOverview[appId].data.price_overview.initial,
        }).into('app_price');
      }
    }

    if (existingWatcher) {
      await db('app_watcher')
        .update({
          watchNews: types.includes(WATCHER_TYPE.NEWS) || existingWatcher.watchNews,
          watchPrice: types.includes(WATCHER_TYPE.PRICE) || existingWatcher.watchPrice,
        })
        .where({
          appId,
          channelId: watcherChannelId,
          guildId: message.guild.id,
        });
    } else {
      await db.insert({
        appId,
        channelId: watcherChannelId,
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
        ${(existingWatcher ? 'in' : 'to')} <#${watcherChannelId}>.
      `,
    });
  }
}
