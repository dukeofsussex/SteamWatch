import { oneLine } from 'common-tags';
import SteamID from 'steamid';
import { EResult } from 'steam-user';
import SteamAPI, { AppType } from './SteamAPI';
import steamClient from './SteamClient';
import { FileType, PublishedFile } from './SteamWatchUser';
import db, {
  App,
  CurrencyCode,
  Group,
  UGC,
  WatcherType,
} from '../db';
import { capitalize } from '../utils';

interface CurrencyFormatOptions {
  append?: string;
  prepend?: string;
  noDecimals?: boolean;
  useComma?: boolean;
}

interface PriceDisplay {
  currency: CurrencyCode;
  discount: number;
  final: number;
  initial: number;
}

const CurrencyFormats: { [key in CurrencyCode]: CurrencyFormatOptions } = {
  AED: { append: ' AED' },
  ARS: { prepend: 'ARS$ ', useComma: true },
  AUD: { prepend: 'A$ ' },
  BRL: { prepend: 'R$ ', useComma: true },
  CAD: { prepend: 'CDN$ ' },
  CHF: { prepend: 'CHF ' },
  CLP: { prepend: 'CLP$ ', noDecimals: true },
  CNY: { prepend: '¥ ', noDecimals: true },
  'CIS-USD': { append: ' USD', prepend: '$' },
  COP: { prepend: 'COL$ ', noDecimals: true },
  CRC: { prepend: '₡', noDecimals: true },
  EUR: { append: '€', useComma: true },
  GBP: { prepend: '£' },
  HKD: { prepend: 'HK$ ' },
  IDR: { prepend: 'Rp ', noDecimals: true },
  ILS: { prepend: '₪' },
  INR: { prepend: '₹ ', noDecimals: true },
  JPY: { prepend: '¥ ', noDecimals: true },
  KRW: { prepend: '₩ ', noDecimals: true },
  KWD: { append: ' KD' },
  KZT: { append: '₸', noDecimals: true },
  MXN: { prepend: 'Mex$ ' },
  MYR: { prepend: 'RM' },
  NOK: { append: ' kr', useComma: true },
  NZD: { prepend: 'NZ$ ' },
  PEN: { prepend: 'S/.' },
  PHP: { prepend: '₱' },
  PLN: { append: 'zł', useComma: true },
  QAR: { append: ' QR' },
  RUB: { append: ' ₽', noDecimals: true },
  SAR: { append: ' SR' },
  'SASIA-USD': { append: ' USD', prepend: '$' },
  SGD: { prepend: 'S$' },
  THB: { prepend: '฿' },
  TRY: { prepend: '₺', useComma: true },
  TWD: { prepend: 'NT$ ', noDecimals: true },
  UAH: { append: '₴', noDecimals: true },
  USD: { prepend: '$' },
  UYU: { prepend: '$U', noDecimals: true },
  VND: { append: '₫', noDecimals: true },
  ZAR: { prepend: 'R ' },
};

const PermittedAppTypes: Record<WatcherType, AppType[]> = {
  [WatcherType.CURATOR]: [],
  [WatcherType.GROUP]: [],
  [WatcherType.NEWS]: ['application', 'game', 'config', 'hardware'],
  [WatcherType.PRICE]: ['application', 'dlc', 'game', 'hardware', 'music', 'video'],
  [WatcherType.UGC]: [],
  [WatcherType.WORKSHOP]: ['game'],
};

export default class SteamUtil {
  static readonly BP = {
    AppNews: (appId: number) => SteamUtil.BP.Raw(`appnews/${appId}`),
    Community: () => SteamUtil.BP.Raw('url/CommunityHome'),
    EventAnnouncement: (appId: number, eventId: string) => SteamUtil.BP.Raw(`url/EventAnnouncementPage/${appId}/${eventId}`),
    GameHub: (id: string) => SteamUtil.BP.Raw(`url/GameHub/${id}`),
    Group: (id: number) => SteamUtil.BP.Raw(`url/GroupSteamIDPage/${id}`),
    GroupEventsPage: (id: number) => SteamUtil.BP.Raw(`url/GroupEventsPage/${id}`),
    MarketListing: (appId: number, marketHashName: string) => SteamUtil.BP.Raw(`url/CommunityMarketSearch/${appId}/${marketHashName}`),
    Profile: (id: string) => SteamUtil.BP.Raw(`url/SteamIDPage/${id}`),
    Raw: (path: string) => `steam://${path}`,
    Store: (id: number) => SteamUtil.BP.Raw(`store/${id}`),
    UGC: (id: string) => SteamUtil.BP.Raw(`url/CommunityFilePage/${id}`),
    Workshop: (id: number) => SteamUtil.BP.Raw(`url/SteamWorkshopPage/${id}`),
    FromType: (id: string, type: WatcherType) => {
      switch (type) {
        case WatcherType.CURATOR:
        case WatcherType.GROUP:
          return SteamUtil.BP.Group(parseInt(id, 10));
        case WatcherType.NEWS:
          return SteamUtil.BP.AppNews(parseInt(id, 10));
        case WatcherType.UGC:
          return SteamUtil.BP.UGC(id);
        case WatcherType.WORKSHOP:
          return SteamUtil.BP.Workshop(parseInt(id, 10));
        default:
          return SteamUtil.BP.Store(parseInt(id, 10));
      }
    },
  };

  static readonly REGEXPS = {
    AppNews: /news\/app\/(\d+)/,
    Community: /steamcommunity\.com/,
    Curator: /steampowered\.com\/curator\/(\d+)/,
    EventAnnouncement: /news\/app\/(\d+)\/view\/(\d+)/,
    GameHub: /steamcommunity\.com\/app\/(\d+)/,
    Group: /steamcommunity\.com\/groups\/([^/]+)/,
    MarketListing: /steamcommunity\.com\/market\/listings\/(\d+)\/(.+)/,
    Profile: /steamcommunity\.com\/(?:profiles|id)\/(\d{17}|[\w-]{2,32})/,
    SteamId: /(STEAM_[0-5]:[01]:\d+)|(\[U:[10]:\d+\])|(\d{17})/i,
    Store: /steampowered\.com(?:\/agecheck)?\/app\/(\d+)/,
    UGC: /filedetails\/\?id=(\d+)/,
    Workshop: /steamcommunity\.com\/app\/(\d+)\/workshop/,
  };

  static readonly URLS = {
    AppNews: (appId: number) => `https://store.steampowered.com/news/app/${appId}`,
    EventAnnouncement: (appId: number, eventId: string, type: 'app' | 'group') => `https://store.steampowered.com/news/${type}/${appId}/view/${eventId}`,
    Curator: (id: number) => `https://store.steampowered.com/curator/${id}`,
    Group: (identifier: string | number) => `https://steamcommunity.com/${(typeof identifier === 'number' ? 'gid' : 'groups')}/${identifier}`,
    GroupAvatar: (avatar: string, size: 'full' | 'medium') => `https://avatars.akamai.steamstatic.com/${avatar}_${size}.jpg`,
    Icon: (appId: number, icon: string) => `https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/${appId}/${icon}.jpg`,
    MarketListing: (appId: number, marketHashName: string) => encodeURI(`https://steamcommunity.com/market/listings/${appId}/${marketHashName}`),
    MarketListingIcon: (icon: string) => `https://community.cloudflare.steamstatic.com/economy/image/${icon}`,
    NewsImage: (imageUrl: string) => imageUrl.replace(/\{STEAM_CLAN(?:_LOC)?_IMAGE\}/, 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/clans'),
    Profile: (steamId: string) => `https://steamcommunity.com/profiles/${steamId}`,
    Store: (appId: number) => `https://store.steampowered.com/app/${appId}`,
    UGC: (ugcId: string) => `https://steamcommunity.com/sharedfiles/filedetails/?id=${ugcId}`,
    Workshop: (appId: number) => `https://store.steampowered.com/app/${appId}/workshop`,
    FromType: (id: string, type: WatcherType) => {
      switch (type) {
        case WatcherType.CURATOR:
          return SteamUtil.URLS.Curator(parseInt(id, 10));
        case WatcherType.GROUP:
          return SteamUtil.URLS.Group(id);
        case WatcherType.NEWS:
          return SteamUtil.URLS.AppNews(parseInt(id, 10));
        case WatcherType.UGC:
          return SteamUtil.URLS.UGC(id);
        case WatcherType.WORKSHOP:
          return SteamUtil.URLS.Workshop(parseInt(id, 10));
        default:
          return SteamUtil.URLS.Store(parseInt(id, 10));
      }
    },
  };

  static canHaveWatcher(appType: AppType, watcherType: WatcherType) {
    return PermittedAppTypes[watcherType].includes(appType);
  }

  static async createAppAutocomplete(query: string) {
    if (!query.length) {
      return [];
    }

    const results = await SteamAPI.searchStore(query);

    return results?.map((r) => ({
      name: r.name,
      value: r.id.toString(),
    })) ?? [];
  }

  static formatFileSize(bytes: number) {
    const block = 1024;
    const decimals = 3;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];

    const i = Math.floor(Math.log(bytes) / Math.log(block));

    return `${parseFloat((bytes / block ** i).toFixed(decimals))} ${sizes[i]}`;
  }

  static formatPrice(amount: number, currency: CurrencyCode) {
    const options = CurrencyFormats[currency];
    let fixedAmount = amount.toString().slice(0, -2);

    if (!options.noDecimals) {
      fixedAmount += options.useComma ? ',' : '.';
      fixedAmount += amount.toString().slice(-2);
    }

    if (fixedAmount.startsWith(',') || fixedAmount.startsWith('.')) {
      fixedAmount = `0${fixedAmount}`;
    }

    return `${(options.prepend || '')}${fixedAmount}${(options.append || '')}`;
  }

  static formatPriceDisplay({
    currency,
    discount,
    final,
    initial,
  }: PriceDisplay) {
    return discount
      ? oneLine`
        ~~${this.formatPrice(initial, currency)}~~\n
        **${this.formatPrice(final, currency)}**
        (-${discount}%)
      ` : this.formatPrice(initial, currency);
  }

  static async findAppId(id: string) {
    let appId: number | null = Number.parseInt(id, 10);
    if (!Number.isNaN(appId) && Number.isFinite(appId)) {
      return appId > 0 && appId < 100000000 ? appId : null;
    }

    const urlMatch = id.match(/\/app\/(\d+)\/?/);
    if (urlMatch) {
      return Number.parseInt(urlMatch[1]!, 10);
    }

    appId = await db.select('id')
      .from('app')
      .where('id', id)
      .orWhere('name', 'like', `%${id}%`)
      .first()
      .then((res) => res?.id || null);

    if (!appId) {
      const results = await SteamAPI.searchStore(id);
      appId = results?.[0]?.id ?? null;
    }

    return appId;
  }

  static async findSteamId(id: string) {
    const match = id.match(SteamUtil.REGEXPS.SteamId);
    if (match) {
      return new SteamID(match[0]!);
    }

    const urlParts = id.split('/').filter((p) => p);
    const resolvedId = await SteamAPI.resolveVanityUrl(urlParts[urlParts.length - 1]!);
    return new SteamID(resolvedId!);
  }

  static findGroupIdentifier(id: string) {
    const groupId = Number.parseInt(id, 10);

    if (!Number.isNaN(groupId) && Number.isFinite(groupId)) {
      return groupId;
    }

    let match = id.match(SteamUtil.REGEXPS.Curator);

    if (match) {
      return parseInt(match[1]!, 10);
    }

    match = id.match(SteamUtil.REGEXPS.Group);

    if (match) {
      return match[1]!;
    }

    return id;
  }

  static findUGCId(id: string) {
    return id.match(SteamUtil.REGEXPS.UGC)?.[1] ?? id.match(/\d+/)?.[0];
  }

  static async persistApp(appId: number) {
    const appInfo = (await steamClient.getProductInfo([appId], [], true))
      .apps[appId]?.appinfo;

    if (!appInfo || !appInfo.common) {
      return null;
    }

    const type = capitalize(appInfo.common.type);

    const app: App = {
      id: appId,
      name: appInfo.common.name,
      icon: appInfo.common.icon || '',
      type,
      lastCheckedNews: null,
      lastCheckedUgc: null,
    };

    await db.insert(app).into('app');

    return app;
  }

  static async persistGroup(identifier: string | number) {
    const details = await SteamAPI.getGroupDetails(identifier);

    if (!details) {
      return null;
    }

    const group: Group = {
      id: details.clanAccountID,
      name: details.group_name,
      avatar: SteamAPI.getGroupAvatarHash(details.avatar_full_url),
      vanityUrl: details.vanity_url,
      lastCheckedNews: null,
      lastReviewedAppId: null,
      lastCheckedReviews: null,
    };

    await db.insert(group)
      .into('`group`');

    return group;
  }

  static async persistUGC(ugcId: string) {
    const published = (await steamClient.getPublishedFileDetails([parseInt(ugcId, 10)])) as any;
    const file = published?.files?.[ugcId] as PublishedFile;

    if (!file) {
      throw new Error(`Nothing found with the id **${ugcId}**`);
    } else if (file.banned) {
      throw new Error(`File banned! Reason: ${file.ban_reason || 'Unknown'}`);
    } else if (file.result !== EResult.OK) {
      throw new Error(`Invalid result: **${EResult[file.result]}**`);
    } else if (file.file_type !== FileType.Collection && !file.can_subscribe) {
      throw new Error(`Cannot watch UGC of type ${FileType[file.file_type]}`);
    }

    const app = (await db.select('id')
      .from('app')
      .where('id', file.consumer_appid)
      .first())
      || (await SteamUtil.persistApp(file.consumer_appid));

    if (!app) {
      throw new Error(`App not found with the id **${file.consumer_appid}**`);
    }

    const ugc: UGC = {
      id: ugcId,
      appId: file.consumer_appid,
      lastChecked: null,
      name: file.title,
    };

    await db.insert(ugc).into('ugc');

    return ugc;
  }
}
