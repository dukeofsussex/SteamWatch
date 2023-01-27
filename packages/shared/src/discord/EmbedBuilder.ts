import { oneLine, stripIndents } from 'common-tags';
import { decode } from 'html-entities';
import {
  ButtonStyle,
  ComponentType,
  MessageEmbedOptions,
  MessageOptions,
} from 'slash-create';
import DiscordUtil from './DiscordUtil';
import { DEFAULT_CURRENCY, EMBED_COLOURS, EMOJIS } from '../constants';
import db, { App, Currency, CurrencyCode } from '../db';
import SteamAPI, { NewsPost, PriceOverview, Tag } from '../steam/SteamAPI';
import steamClient from '../steam/SteamClient';
import { FileType, PublishedFile, SteamDeckCompatibility } from '../steam/SteamWatchUser';
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
      title,
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
    const transformed = transformArticle(news.contents);

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

    const [details, steamdeck] = await Promise.all([
      SteamAPI.getAppDetails(appId, currency.countryCode),
      steamClient.getProductInfo([appId], []),
    ]);
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

    const steamdeckCompatibility = parseInt(
      steamdeck.apps[appId]?.appinfo
        .common
        .steam_deck_compatibility
        ?.category
      ?? SteamDeckCompatibility.Unknown,
      10,
    );

    return {
      embeds: [{
        color: EMBED_COLOURS.DEFAULT,
        description: decode(details.short_description) || '',
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
          ...(details.developers?.length ? [{
            name: 'Developers',
            value: details.developers.join('\n') || 'Unknown',
            inline: true,
          }] : []),
          ...(details.publishers?.length && details.publishers[0]?.length ? [{
            name: 'Publishers',
            value: details.publishers.join('\n'),
            inline: true,
          }] : []),
          ...(playerCount !== null ? [{
            name: 'Player Count',
            value: playerCount.toString(),
            inline: true,
          }] : []),
          ...(details.release_date ? [{
            name: 'Release Date',
            value: details.release_date.date || 'Unknown',
            inline: true,
          }] : []),
          ...(details.achievements || details.recommendations ? [{
            name: 'Details',
            value: stripIndents`
              ${DiscordUtil.getStateEmoji(details.achievements)} **Achievements:** ${details.achievements?.total || 0}
              ${DiscordUtil.getStateEmoji(details.recommendations)} **Recommendations:** ${details.recommendations?.total || 0}
            `,
            inline: true,
          }] : []),
          ...(details.categories?.length ? [{
            name: 'Categories',
            value: details.categories.map((c: Tag) => c.description).join('\n'),
            inline: true,
          }] : []),
          ...(details.genres?.length ? [{
            name: 'Genres',
            value: details.genres.map((g: Tag) => g.description).join('\n'),
            inline: true,
          }] : []),
          ...(details.platforms ? [{
            name: 'Platforms',
            value: stripIndents`
              ${DiscordUtil.getStateEmoji(details.platforms.windows)} **Windows**
              ${DiscordUtil.getStateEmoji(details.platforms.mac)} **Mac**
              ${DiscordUtil.getStateEmoji(details.platforms.linux)} **Linux**
            `,
            inline: true,
          }] : []),
          {
            name: 'Steam Deck Compatibility',
            value: oneLine`
              ${steamdeckCompatibility === SteamDeckCompatibility.Verified ? EMOJIS.SUCCESS : ''}
              ${steamdeckCompatibility === SteamDeckCompatibility.Playable ? EMOJIS.WARNING : ''}
              ${steamdeckCompatibility === SteamDeckCompatibility.Unsupported ? EMOJIS.ERROR : ''}
              **${SteamDeckCompatibility[steamdeckCompatibility] || 'Unknown'}**
            `,
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

  static async createWorkshop(app: AppMinimal, file: PublishedFile, timestamp: keyof Pick<PublishedFile, 'time_created' | 'time_updated'>): Promise<MessageEmbedOptions> {
    const author = await SteamAPI.getPlayerSummary(file.creator);

    return {
      ...this.createApp(app, {
        description: transformArticle(file.file_description).markdown,
        timestamp: new Date(file[timestamp] * 1000),
        title: file.title,
        url: SteamUtil.URLS.UGC(file.publishedfileid),
      }),
      ...(author ? {
        author: {
          name: author.personaname,
          icon_url: author.avatar,
          url: SteamUtil.URLS.Profile(author.steamid),
        },
      } : {}),
      ...(file.preview_url ? {
        image: {
          url: file.preview_url,
        },
      } : {}),
      fields: [{
        name: 'Tags',
        value: file.tags.map((tag) => tag.tag).join('\n') || 'None',
        inline: true,
      },
      {
        name: 'Type',
        value: FileType[file.file_type] || 'Unknown',
        inline: true,
      },
      ...([
        FileType.Art,
        FileType.Item,
        FileType.Microtransaction,
        FileType.Screenshot,
        FileType.WebGuide,
      ].includes(file.file_type) ? [{
          name: 'File Size',
          value: SteamUtil.formatFileSize(parseInt(file.file_size, 10)),
          inline: true,
        }] : []),
      {
        name: 'Steam Client Link',
        value: SteamUtil.BP.UGC(file.publishedfileid),
      }],
    };
  }
}
