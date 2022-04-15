import { stripIndents } from 'common-tags';
import {
  ButtonStyle,
  ComponentType,
  MessageEmbedOptions,
  MessageOptions,
} from 'slash-create';
import { EMBED_COLOURS } from './constants';
import env from './env';
import Util from './Util';
import db from '../db';
import { App, Currency, CurrencyCode } from '../db/knex';
import SteamAPI, {
  NewsPost,
  PriceOverview,
  Tag,
  UGC,
} from '../steam/SteamAPI';
import SteamUtil from '../steam/SteamUtil';
import transformArticle from './transformers';

export type AppMinimal = Pick<App, 'icon' | 'id' | 'name'>;

const DEFAULT_CURRENCY = { code: 'USD', countryCode: 'US' };

export default class EmbedBuilder {
  static createApp(
    app: AppMinimal,
    {
      description,
      timestamp,
      title,
      url,
    }: Pick<MessageEmbedOptions, 'description' | 'timestamp' | 'title' | 'url'>,
  ): MessageEmbedOptions {
    return {
      color: EMBED_COLOURS.DEFAULT,
      title: `**${title}**`,
      description,
      footer: {
        icon_url: SteamUtil.URLS.Icon(app.id, app.icon),
        text: app.name,
      },
      url,
      timestamp,
      thumbnail: {
        url: SteamUtil.URLS.Icon(app.id, app.icon),
      },
    };
  }

  static createNews(app: AppMinimal, news: NewsPost): MessageEmbedOptions {
    const transformed = transformArticle(
      news.contents,
      env.settings.maxArticleLength,
      env.settings.maxArticleNewlines,
    );

    return {
      ...this.createApp(app, {
        // Truncate long news titles
        title: news.title.length > 128 ? `${news.title.substring(0, 125)}...` : news.title,
        description: transformed.markdown,
        url: news.url,
        timestamp: new Date(news.date * 1000),
      }),
      author: news.author ? {
        name: news.author,
      } : undefined,
      image: transformed.thumbnail ? {
        url: SteamUtil.URLS.NewsImage(transformed.thumbnail),
      } : undefined,
      fields: [{
        name: 'Steam Client Link',
        value: SteamUtil.BP.AppNews(app.id),
      }],
    };
  }

  static createPrice(
    app: AppMinimal,
    currencyCode: CurrencyCode,
    priceOverview: PriceOverview,
  ): MessageEmbedOptions {
    return {
      ...this.createApp(app, {
        description: SteamUtil.formatPriceDisplay({
          currency: currencyCode,
          discount: priceOverview.discount_percent,
          final: priceOverview.final,
          initial: priceOverview.initial,
        }),
        timestamp: new Date(),
        title: app.name,
        url: SteamUtil.URLS.Store(app.id),
      }),
      fields: [{
        name: 'Steam Client Link',
        value: SteamUtil.BP.Store(app.id),
      }],
    };
  }

  static async createStoreMessage(appId: number, guildId?: string): Promise<MessageOptions | null> {
    let currency: Pick<Currency, 'code' | 'countryCode'> = !guildId
      ? DEFAULT_CURRENCY
      : await db.select('code', 'country_code')
        .from('currency')
        .innerJoin('guild', 'guild.currency_id', 'currency.id')
        .where('guild.id', guildId)
        .first();
    currency = currency || DEFAULT_CURRENCY;

    const details = await SteamAPI.getAppDetails(appId, currency.countryCode);
    let playerCount: number | null = null;

    if (details?.type === 'game') {
      playerCount = await SteamAPI.getNumberOfCurrentPlayers(appId!);
    }

    if (!details) {
      return null;
    }

    let price = 'N/A';

    if (details.is_free) {
      price = '**Free**';
    } else if (details.price_overview) {
      price = SteamUtil.formatPriceDisplay({
        currency: currency.code,
        discount: details.price_overview.discount_percent,
        final: details.price_overview.final,
        initial: details.price_overview.initial,
      });
    }

    return {
      embeds: [{
        color: EMBED_COLOURS.DEFAULT,
        description: details.short_description,
        title: details.name,
        image: {
          url: details.header_image,
        },
        timestamp: new Date(),
        url: SteamUtil.URLS.Store(appId!),
        fields: [
          {
            name: 'Price',
            value: price,
            inline: true,
          },
          {
            name: 'Developers',
            value: details.developers.join('\n'),
            inline: true,
          },
          {
            name: 'Publishers',
            value: details.publishers?.join('\n') || 'None',
            inline: true,
          },
          ...(playerCount !== null ? [{
            name: 'Player Count',
            value: playerCount.toString(),
            inline: true,
          }] : []),
          {
            name: 'Release Date',
            value: details.release_date.date,
            inline: true,
          },
          {
            name: 'Details',
            value: stripIndents`
              ${Util.getStateEmoji(details.achievements)} **Achievements:** ${details.achievements?.total || 0}
              ${Util.getStateEmoji(details.recommendations)} **Recommendations:** ${details.recommendations?.total || 0}
            `,
            inline: true,
          },
          ...(details.categories ? [{
            name: 'Categories',
            value: details.categories.map((c: Tag) => c.description).join('\n'),
            inline: true,
          }] : []),
          ...(details.genres ? [{
            name: 'Genres',
            value: details.genres.map((g: Tag) => g.description).join('\n'),
            inline: true,
          }] : []),
          {
            name: 'Platforms',
            value: stripIndents`
              ${Util.getStateEmoji(details.platforms.windows)} **Windows**
              ${Util.getStateEmoji(details.platforms.mac)} **Mac**
              ${Util.getStateEmoji(details.platforms.linux)} **Linux**
            `,
            inline: true,
          },
          {
            name: 'Steam Client Link',
            value: SteamUtil.BP.Store(appId!),
          },
        ],
      }],
      components: (details.website ? [{
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.BUTTON,
            label: 'View Website',
            style: ButtonStyle.LINK,
            url: details.website,
          },
        ],
      },
      ] : []),
    };
  }

  static async createWorkshop(app: AppMinimal, ugc: UGC): Promise<MessageEmbedOptions> {
    const author = await SteamAPI.getPlayerSummary(ugc.creator);

    return {
      ...this.createApp(app, {
        description: ugc.description,
        timestamp: new Date(ugc.time_updated * 1000),
        title: ugc.title,
        url: SteamUtil.URLS.UGC(ugc.publishedfileid),
      }),
      author: author ? {
        name: author.personaname,
        icon_url: author.avatar,
        url: SteamUtil.URLS.Profile(author.steamid),
      } : undefined,
      image: ugc.preview_url ? {
        url: ugc.preview_url,
      } : undefined,
      fields: [{
        name: 'Steam Client Link',
        value: SteamUtil.BP.UGC(ugc.publishedfileid),
      }],
    };
  }
}
