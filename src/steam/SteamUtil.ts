import { oneLine } from 'common-tags';
import SteamID from 'steamid';
import { EResult } from 'steam-user';
import SteamAPI from './SteamAPI';
import steamUser from './SteamUser';
import db from '../db';
import { App, CurrencyCode, UGC } from '../db/knex';
import { WatcherType } from '../types';
import { PERMITTED_APP_TYPES } from '../utils/constants';
import Util from '../utils/Util';

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

export default class SteamUtil {
  static readonly BP = {
    AppNews: (id: string) => SteamUtil.BP.Raw(`appnews/${id}`),
    Community: () => SteamUtil.BP.Raw('url/CommunityHome'),
    GameHub: (id: string) => SteamUtil.BP.Raw(`url/GameHub/${id}`),
    Profile: (id: string) => SteamUtil.BP.Raw(`url/SteamIDPage/${id}`),
    Raw: (path: string) => `steam://${path}`,
    Store: (id: number) => SteamUtil.BP.Raw(`store/${id}`),
    UGC: (id: string) => SteamUtil.BP.Raw(`url/CommunityFilePage/${id}`),
    Workshop: (id: number) => SteamUtil.BP.Raw(`url/SteamWorkshopPage/${id}`),
  };

  static readonly REGEXPS = {
    AppNews: /news\/app\/(\d+)/,
    Community: /steamcommunity\.com/,
    GameHub: /steamcommunity\.com\/app\/(\d+)/,
    Profile: /steamcommunity\.com\/(?:profiles|id)\/(\d{17}|[\w-]{2,32})/,
    SteamId: /(STEAM_[0-5]:[01]:\d+)|(\[U:[10]:\d+\])|(\d{17})/i,
    Store: /steampowered\.com\/app\/(\d+)/,
    UGC: /sharedfiles\/filedetails\/\?id=(\d+)/,
    Workshop: /steamcommunity\.com\/app\/(\d+)\/workshop/,
  };

  static readonly URLS = {
    AppNews: (appId: number) => `https://store.steampowered.com/news/app/${appId}`,
    Icon: (appId: number, icon: string) => `https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/${appId}/${icon}.jpg`,
    NewsImage: (imageUrl: string) => imageUrl.replace(/\{STEAM_CLAN(?:_LOC)?_IMAGE\}/, 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/clans'),
    Profile: (steamId: string) => `https://steamcommunity.com/profiles/${steamId}`,
    Store: (appId: number) => `https://store.steampowered.com/app/${appId}`,
    UGC: (ugcId: string) => `https://steamcommunity.com/sharedfiles/filedetails/?id=${ugcId}`,
    Workshop: (appId: number) => `https://store.steampowered.com/app/${appId}/workshop`,
  };

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
      return appId > 0 ? appId : null;
    }

    const urlMatch = id.match(/\/app\/(\d+)\/?/);
    if (urlMatch) {
      return Number.parseInt(urlMatch[1], 10);
    }

    appId = await db.select('id')
      .from('app')
      .where('name', 'like', `%${id}%`)
      .orWhere('id', id)
      .first()
      .then((res) => res?.id || null);

    if (!appId) {
      const results = await SteamAPI.searchStore(id);
      appId = results?.[0].id ?? null;
    }

    return appId;
  }

  static findUGCId(id: string) {
    return id.match(SteamUtil.REGEXPS.UGC)?.[1] ?? id.match(/\d+/)?.[0];
  }

  static async findId(id: string) {
    const match = id.match(SteamUtil.REGEXPS.SteamId);
    if (match) {
      return new SteamID(match[0]);
    }

    const urlParts = id.split('/').filter((p) => p);
    const resolvedId = await SteamAPI.resolveVanityUrl(urlParts[urlParts.length - 1]);
    return new SteamID(resolvedId!);
  }

  static async persistApp(appId: number) {
    const appInfo = (await steamUser.getProductInfo([appId], [], true))
      .apps[appId]?.appinfo;

    if (!appInfo) {
      return null;
    }

    const type = Util.capitalize(appInfo.common.type);

    const app: App = {
      id: appId,
      name: appInfo.common.name,
      icon: appInfo.common.icon || '',
      type,
      lastCheckedNews: PERMITTED_APP_TYPES[WatcherType.NEWS].includes(type) ? new Date() : null,
      lastCheckedUgc: new Date(),
      latestNews: null,
      latestUgc: null,
    };

    await db.insert(app).into('app');

    return app;
  }

  static async persistUGC(ugcId: string) {
    const file = (await SteamAPI.getPublishedFileDetails([ugcId]))?.[0];

    if (!file) {
      throw new Error(`Nothing found with the id **${ugcId}**`);
    } else if (file.banned) {
      throw new Error(`File banned! Reason: ${file.ban_reason || 'Unknown'}`);
    } else if (file.result !== EResult.OK) {
      throw new Error(`Invalid result: **${EResult[file.result]}**`);
    }

    const app = (await db.select('id')
      .from('app')
      .where('id', file.consumer_app_id)
      .first())
      || (await SteamUtil.persistApp(file.consumer_app_id));

    if (!app) {
      throw new Error(`App not found with the id **${file.consumer_app_id}**`);
    }

    const ugc: UGC = {
      id: ugcId,
      appId: file.consumer_app_id,
      lastChecked: null,
      lastUpdate: new Date(file.time_updated * 1000),
      name: file.title,
    };

    await db.insert(ugc).into('ugc');

    return ugc;
  }
}
