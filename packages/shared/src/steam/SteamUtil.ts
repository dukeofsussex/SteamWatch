import { oneLine } from 'common-tags';
import SteamID from 'steamid';
import { EResult } from 'steam-user';
import SteamAPI, { StoreAppType } from './SteamAPI';
import steamClient from './SteamClient';
import {
  AppInfo,
  EWorkshopFileType,
  PackageInfo,
  PublishedFile,
} from './SteamWatchUser';
import { DEFAULT_STEAM_ICON } from '../constants';
import db, {
  App,
  AppType,
  CurrencyCode,
  Group,
  ForumType,
  FreePackage,
  FreePackageType,
  PriceType,
  UGC,
  WatcherType,
  Bundle,
  Sub,
} from '../db';

export interface CurrencyFormatOptions {
  append?: string;
  prepend?: string;
  scale?: number;
  format?: string;
}

export interface PriceDisplay {
  currency: CurrencyCode;
  discount: number;
  final: number;
  initial: number;
}

const CurrencyFormats: { [key in CurrencyCode]: CurrencyFormatOptions } = {
  AED: { append: ' AED', format: 'ar-AE' },
  ARS: { prepend: 'ARS$ ', format: 'es' },
  AUD: { prepend: 'A$ ' },
  BRL: { prepend: 'R$ ', format: 'pt-BR' },
  CAD: { prepend: 'CDN$ ' },
  CHF: { prepend: 'CHF ' },
  CLP: { prepend: 'CLP$ ', format: 'es', scale: 0 },
  CNY: { prepend: '¥ ', format: 'zh-CN' },
  'CIS-USD': { append: ' USD', prepend: '$' },
  COP: { prepend: 'COL$ ', format: 'es', scale: 0 },
  CRC: { prepend: '₡', format: 'es', scale: 0 },
  EUR: { append: '€', format: 'de' },
  GBP: { prepend: '£' },
  HKD: { prepend: 'HK$ ', format: 'zh-HK' },
  IDR: { prepend: 'Rp ', format: 'id', scale: 0 },
  ILS: { prepend: '₪', format: 'he' },
  INR: { prepend: '₹ ', format: 'hi', scale: 0 },
  JPY: { prepend: '¥ ', format: 'ja', scale: 0 },
  KRW: { prepend: '₩ ', format: 'ko', scale: 0 },
  KWD: { append: ' KD' },
  KZT: { append: '₸', format: 'ru', scale: 0 },
  MXN: { prepend: 'Mex$ ' },
  MYR: { prepend: 'RM', format: 'ms' },
  NOK: { append: ' kr', format: 'no' },
  NZD: { prepend: 'NZ$ ' },
  PEN: { prepend: 'S/.' },
  PHP: { prepend: '₱', format: 'fil' },
  PLN: { append: 'zł', format: 'pl' },
  QAR: { append: ' QR' },
  RUB: { append: ' ₽', format: 'ru', scale: 0 },
  SAR: { append: ' SR' },
  'SASIA-USD': { append: ' USD', prepend: '$' },
  SGD: { prepend: 'S$' },
  THB: { prepend: '฿', format: 'th' },
  TRY: { prepend: '₺', format: 'tr' },
  TWD: { prepend: 'NT$ ', format: 'zh-TW', scale: 0 },
  UAH: { append: '₴', format: 'ua', scale: 0 },
  USD: { prepend: '$' },
  UYU: { prepend: '$U', format: 'es', scale: 0 },
  VND: { append: '₫', format: 'vi', scale: 0 },
  ZAR: { prepend: 'R ' },
};

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
const TrackedAppTypes = new Set(Object.values(AppType));

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
    StoreApp: (id: number) => SteamUtil.BP.Raw(`store/${id}`),
    StoreBundle: (id: number) => SteamUtil.BP.Raw(`openurl/${SteamUtil.URLS.Store(id, PriceType.Bundle)}`),
    StoreSub: (id: number) => SteamUtil.BP.Raw(`url/StoreSubPage/${id}`),
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
    Icon: (appId: number, icon: string | null) => (icon
      ? `https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/${appId}/${icon}.jpg`
      : DEFAULT_STEAM_ICON),
    MarketListing: (appId: number, marketHashName: string) => encodeURI(`https://steamcommunity.com/market/listings/${appId}/${marketHashName}`),
    MarketListingIcon: (icon: string) => `https://community.cloudflare.steamstatic.com/economy/image/${icon}`,
    NewsImage: (imageUrl: string) => imageUrl.replace(/\{STEAM_CLAN(?:_LOC)?_IMAGE\}/, 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/clans'),
    Profile: (steamId: string) => `https://steamcommunity.com/profiles/${steamId}`,
    Store: (id: number, type: PriceType) => `https://store.steampowered.com/${type}/${id}`,
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

    return `${(options.prepend || '')}${Intl.NumberFormat(options.format || 'en-GB', {
      minimumFractionDigits: options.scale !== undefined ? options.scale : 2,
      maximumFractionDigits: options.scale !== undefined ? options.scale : 2,
    }).format(amount / 100)}${(options.append || '')}`;
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
      ` : this.formatPrice(final, currency);
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

    return id.replaceAll(' ', '_');
  }

  static async findStoreItem(id: string) {
    let details: {
      id: number;
      type: StoreAppType;
    } | null;

    const urlMatch = id.match(/\/(app|bundle|sub)\/(\d+)\/?/);
    if (urlMatch) {
      return {
        id: Number.parseInt(urlMatch[2]!, 10),
        type: urlMatch[1]! as StoreAppType,
      };
    }

    details = await db.select('id', 'type')
      .from('app')
      .where('id', id)
      .orWhere('name', 'LIKE', `%${id}%`)
      .union(
        db.select('id', '"bundle" AS type')
          .from('bundle')
          .where('id', id)
          .orWhere('name', 'LIKE', `%${id}%`) as any,
        db.select('id', '"sub" AS type')
          .from('sub')
          .where('id', id)
          .orWhere('name', 'LIKE', `%${id}%`) as any,
      )
      .first() as any;

    // Check strings and app ids
    if (!details) {
      const results = await SteamAPI.searchStore(id);

      details = results?.length ? {
        id: parseInt(results[0]!.id, 10),
        type: results[0]!.type,
      } : null;
    }

    // Store search doesn't support bundle and sub ids
    const parsedId = parseInt(id, 10);

    if (!details && !Number.isNaN(parsedId)) {
      const results = await SteamAPI.getBundlePrices([parsedId], 'US');

      details = results?.length ? {
        id: results[0]!.bundleid,
        type: PriceType.Bundle,
      } : null;
    }

    if (!details && !Number.isNaN(parsedId)) {
      const results = await SteamAPI.getSubPrices([parsedId], 'US');

      details = results?.length ? {
        id: results[0]!.packageid,
        type: PriceType.Sub,
      } : null;
    }

    return details || {
      id: 0,
      type: AppType.Game,
    };
  }

  static findUGCId(id: string) {
    return id.match(SteamUtil.REGEXPS.UGC)?.[1] ?? id.match(/\d+/)?.[0];
  }

  static async getStorePrices(
    ids: number[],
    type: StoreAppType,
    code: CurrencyCode,
    cc: string,
  ) : Promise<Record<number, Omit<PriceDisplay, 'currency'> | null>> {
    if (type === PriceType.Bundle) {
      const bundlePrices = await SteamAPI.getBundlePrices(ids, cc);

      if (!bundlePrices?.length) {
        return {};
      }

      return ids.reduce((curr: any, id) => {
        const bundle = bundlePrices.find((b) => b.bundleid === id);

        if (!bundle) {
          // eslint-disable-next-line no-param-reassign
          curr[id] = null;
        } else {
          // eslint-disable-next-line no-param-reassign
          curr[id] = {
            // Steam randomly sets final_price to 0, so we have to extract the raw value ourselves
            final: bundle.final_price
              || parseInt(
                `${bundle.formatted_final_price.replace(/[^\d]/g, '')}${'0'.repeat(CurrencyFormats[code].scale === 0 ? 2 : 0)}`,
                10,
              ),
            initial: bundle.initial_price,
            discount: bundle.discount_percent,
          };
        }

        return curr;
      }, {});
    }

    if (type === PriceType.Sub) {
      const subPrices = await SteamAPI.getSubPrices(ids, cc);

      if (!subPrices?.length) {
        return {};
      }

      return ids.reduce((curr: any, id) => {
        const sub = subPrices.find((b) => b.packageid === id);

        if (!sub) {
          // eslint-disable-next-line no-param-reassign
          curr[id] = null;
        } else {
          // eslint-disable-next-line no-param-reassign
          curr[id] = {
            final: sub.final_price_cents,
            initial: sub.orig_price_cents,
            discount: sub.discount_percent,
          };
        }

        return curr;
      }, {});
    }

    const appPrices = await SteamAPI.getAppPrices(ids, cc);

    if (!appPrices) {
      return {};
    }

    return ids.reduce((curr: any, id) => {
      if (!appPrices[id]?.success) {
        // eslint-disable-next-line no-param-reassign
        curr[id] = null;
      } else {
        const app = appPrices[id]?.data.price_overview;

        // eslint-disable-next-line no-param-reassign
        curr[id] = {
          final: app?.final ?? 0,
          initial: app?.initial ?? 0,
          discount: app?.discount_percent ?? 0,
        };
      }

      return curr;
    }, {});
  }

  static getPriceTypeIdKey(type: PriceType) {
    return `${type}_id`;
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

  static async persistBundle(bundleId: number) {
    const response = await SteamAPI.getBundlePrices([bundleId], 'US');

    if (!response?.length) {
      return null;
    }

    const bundle = {
      id: response[0]!.bundleid,
      name: response[0]!.name,
    } as Bundle;

    await db.insert(bundle).into('bundle');

    return bundle;
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

  static async persistSub(subId: number) {
    const response = await SteamAPI.getSubPrices([subId], 'US');

    if (!response?.length) {
      return null;
    }

    const sub = {
      id: response[0]!.packageid,
      name: response[0]!.name,
    } as Sub;

    await db.insert(sub).into('sub');

    return sub;
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
      lastUpdate: null,
      name: file.title,
    };

    await db.insert(ugc).into('ugc');

    return ugc;
  }
}
