import { oneLine } from 'common-tags';
import SteamID from 'steamid';
import { EResult } from 'steam-user';
import SteamAPI from './SteamAPI';
import steamClient from './SteamClient';
import {
  AppInfo,
  EWorkshopFileType,
  PackageInfo,
  PublishedFile,
} from './SteamWatchUser';
import db, {
  App,
  AppType,
  CurrencyCode,
  Group,
  ForumType,
  FreePackage,
  FreePackageType,
  UGC,
  WatcherType,
} from '../db';

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

const TrackedAppTypes = new Set(Object.values(AppType));
const PermittedAppTypes: Record<WatcherType, AppType[]> = {
  [WatcherType.Curator]: [],
  [WatcherType.Free]: [],
  [WatcherType.Forum]: [],
  [WatcherType.Group]: [],
  [WatcherType.News]: [
    AppType.Application,
    AppType.Config,
    AppType.Game,
    AppType.Hardware,
  ],
  [WatcherType.Price]: [
    AppType.Application,
    AppType.Config,
    AppType.DLC,
    AppType.Game,
    AppType.Hardware,
    AppType.Music,
    AppType.Video,
  ],
  [WatcherType.UGC]: [],
  [WatcherType.WorkshopNew]: [AppType.Game],
  [WatcherType.WorkshopUpdate]: [AppType.Game],
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
    OpenUrl: (url: string) => SteamUtil.BP.Raw(`openurl/${url}`),
    Profile: (id: string) => SteamUtil.BP.Raw(`url/SteamIDPage/${id}`),
    Raw: (path: string) => `steam://${path}`,
    Store: (id: number) => SteamUtil.BP.Raw(`store/${id}`),
    UGC: (id: string) => SteamUtil.BP.Raw(`url/CommunityFilePage/${id}`),
    Workshop: (id: number) => SteamUtil.BP.Raw(`url/SteamWorkshopPage/${id}`),
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
    Forum: (appId: number, groupId: number, subforumId: string, type: ForumType) => {
      const url = 'https://steamcommunity.com';
      let subforum = `discussions/${subforumId}`;

      if (type === ForumType.PublishedFile) {
        return `${url}/sharedfiles/filedetails/${subforum}`;
      }

      if (type === ForumType.Workshop) {
        return `${url}/workshop/${subforum}?appid=${appId}`;
      }

      if (type === ForumType.Event) {
        subforum = 'eventcomments';
      } else if (type === ForumType.Trading) {
        subforum = 'tradingforum';
      }

      if (appId) {
        return `${url}/app/${appId}/${subforum}`;
      }

      return `${url}/gid/${groupId}/${subforum}`;
    },
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

  static isTrackedAppType(appType: string) {
    return TrackedAppTypes.has(appType.toLowerCase() as AppType);
  }

  static async persistApp(appId: number) {
    const { apps } = await steamClient.getProductInfo([appId], [], true);

    if (!apps || !Object.hasOwn(apps, appId)) {
      return null;
    }

    return (await this.persistApps([apps[appId]!]))[0] || null;
  }

  static async persistApps(apps: AppInfo[]) {
    const dbApps = apps.filter(({ appinfo }) => SteamUtil.isTrackedAppType(
      appinfo.common?.type ?? 'Unknown',
    )).map(({ appinfo }) => ({
      id: parseInt(appinfo.appid, 10),
      oggId: null,
      name: appinfo.common!.name,
      icon: appinfo.common!.icon,
      type: appinfo.common!.type.toLowerCase() as AppType,
      lastCheckedNews: null,
    })) as App[];

    if (dbApps.length) {
      await db.insert(dbApps)
        .into('app')
        .onConflict('id')
        .merge(['icon', 'name']);
    }

    return dbApps;
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

  static async persistFreePackages(packages: [string, PackageInfo][], isUpdate: boolean) {
    let freePackages: FreePackage[] = [];

    for (let i = 0; i < packages.length; i += 1) {
      const [id, pkg] = packages[i]!;

      // Ignore unrelated packages
      if (pkg.packageinfo && !pkg.packageinfo.extended.dontgrantifappidowned) {
        // eslint-disable-next-line no-continue
        continue;
      }

      const endTime = pkg.packageinfo?.extended?.expirytime
        ? new Date(pkg.packageinfo.extended.expirytime * 1000)
        : null;

      // Ignore expired packages
      if (endTime && endTime < new Date()) {
        // eslint-disable-next-line no-continue
        continue;
      }

      let type = null;

      if (pkg.packageinfo?.extended?.freepromotion) {
        type = FreePackageType.Promo;
      } else if (pkg.packageinfo?.extended?.freeweekend) {
        type = FreePackageType.Weekend;
      }

      freePackages.push({
        id: parseInt(id, 10),
        appId: pkg.packageinfo?.extended?.dontgrantifappidowned,
        type,
        startTime: pkg.packageinfo?.extended?.starttime
          ? new Date(pkg.packageinfo.extended.starttime * 1000)
          : null,
        endTime,
        active: false,
        lastChecked: new Date(),
        lastUpdate: new Date(),
      });
    }

    if (!freePackages.length) {
      return;
    }

    // Check related apps
    const res = await steamClient.getProductInfo(
      freePackages.reduce((ids, pkg) => {
        if (pkg.appId) {
          ids.push(pkg.appId);
        }

        return ids;
      }, [] as number[]),
      [],
      true,
    );

    const apps = await SteamUtil.persistApps(Object.values(res.apps));
    const storedAppids = apps.map((app) => app.id);

    // Filter out packages for ignored app types
    freePackages = freePackages.filter((pkg) => !pkg.appId || storedAppids.includes(pkg.appId!));

    const cols = ['appId', 'endTime', 'lastChecked', 'startTime', 'type', ...(isUpdate ? ['lastUpdate'] : [])];

    if (freePackages.length) {
      await db.insert([...freePackages.values()])
        .into('free_package')
        .onConflict('id')
        .merge(cols as any);
    }
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
    } else if (file.file_type !== EWorkshopFileType.Collection && !file.can_subscribe) {
      throw new Error(`Cannot watch UGC of type ${EWorkshopFileType[file.file_type]}`);
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
