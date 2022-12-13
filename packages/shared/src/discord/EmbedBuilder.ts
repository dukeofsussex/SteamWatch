import { stripIndents } from 'common-tags';
import {
  ButtonStyle,
  ComponentType,
  MessageEmbedOptions,
  MessageOptions,
} from 'slash-create';
import DiscordUtil from './DiscordUtil';
import { DEFAULT_CURRENCY, EMBED_COLOURS } from '../constants';
import db, { App, Currency, CurrencyCode } from '../db';
import env from '../env';
import SteamAPI, {
  NewsPost,
  PriceOverview,
  SteamUGC,
  Tag,
} from '../steam/SteamAPI';
import SteamUtil from '../steam/SteamUtil';
import transformArticle from '../transformers';

export type AppMinimal = Pick<App, 'icon' | 'id' | 'name'>;

export default class EmbedBuilder {
  static createApp(
    app: AppMinimal,
    {
      description,
      timestamp,
      title,
      url,
    }: Required<Pick<MessageEmbedOptions, 'description' | 'timestamp' | 'title' | 'url'>>,
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

  static async createNews(app: AppMinimal, news: NewsPost): Promise<MessageEmbedOptions> {
    const transformed = transformArticle(
      news.contents,
      env.settings.maxArticleLength,
      env.settings.maxArticleNewlines,
    );

    let eventId = null;

    if (news.feedname === 'steam_community_announcements') {
      eventId = await SteamAPI.getEventIdForArticle(news.url);
    }

    return {
      ...this.createApp(app, {
        // Truncate long news titles
        title: news.title.length > 128 ? `${news.title.substring(0, 125)}...` : news.title,
        description: transformed.markdown,
        url: eventId ? SteamUtil.URLS.EventAnnouncement(app.id, eventId) : news.url,
        timestamp: new Date(news.date * 1000),
      }),
      ...(news.author ? {
        author: {
          name: news.author,
        },
      } : {}),
      ...(transformed.thumbnail ? {
        image: {
          url: SteamUtil.URLS.NewsImage(transformed.thumbnail),
        },
      } : {}),
      fields: eventId
        ? [{
          name: 'Steam Client Link',
          value: SteamUtil.BP.EventAnnouncement(app.id, eventId),
        }] : [],
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

  static async createStore(appId: number, guildId?: string): Promise<MessageOptions | null> {
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
            value: details.release_date.date || 'Unknown',
            inline: true,
          },
          {
            name: 'Details',
            value: stripIndents`
              ${DiscordUtil.getStateEmoji(details.achievements)} **Achievements:** ${details.achievements?.total || 0}
              ${DiscordUtil.getStateEmoji(details.recommendations)} **Recommendations:** ${details.recommendations?.total || 0}
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
              ${DiscordUtil.getStateEmoji(details.platforms.windows)} **Windows**
              ${DiscordUtil.getStateEmoji(details.platforms.mac)} **Mac**
              ${DiscordUtil.getStateEmoji(details.platforms.linux)} **Linux**
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

  static async createWorkshop(app: AppMinimal, ugc: SteamUGC): Promise<MessageEmbedOptions> {
    const author = await SteamAPI.getPlayerSummary(ugc.creator);

    return {
      ...this.createApp(app, {
        description: ugc.description,
        timestamp: new Date(ugc.time_updated * 1000),
        title: ugc.title,
        url: SteamUtil.URLS.UGC(ugc.publishedfileid),
      }),
      ...(author ? {
        author: {
          name: author.personaname,
          icon_url: author.avatar,
          url: SteamUtil.URLS.Profile(author.steamid),
        },
      } : {}),
      ...(ugc.preview_url ? {
        image: {
          url: ugc.preview_url,
        },
      } : {}),
      fields: [{
        name: 'Steam Client Link',
        value: SteamUtil.BP.UGC(ugc.publishedfileid),
      }],
    };
  }
}
