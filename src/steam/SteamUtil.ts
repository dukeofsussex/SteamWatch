import { oneLine, stripIndents } from 'common-tags';
import {
  ButtonStyle,
  CommandContext,
  ComponentButtonLink,
  ComponentType,
} from 'slash-create';
import SteamID from 'steamid';
import SteamAPI from './SteamAPI';
import db from '../db';
import { EMBED_COLOURS } from '../utils/constants';
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

export type CurrencyCode = 'AED' | 'ARS' | 'AUD' | 'BRL' | 'CAD' | 'CHF'
| 'CLP' | 'CNY' | 'COP' | 'CRC' | 'EUR' | 'GBP' | 'HKD' | 'ILS'
| 'IDR' | 'INR' | 'JPY' | 'KRW' | 'KWD' | 'KZT' | 'MXN' | 'MYR'
| 'NOK' | 'NZD' | 'PEN' | 'PHP' | 'PLN' | 'QAR' | 'RUB' | 'SAR'
| 'SGD' | 'THB' | 'TRY' | 'TWD' | 'UAH' | 'USD' | 'UYU' | 'VND'
| 'ZAR' | 'CIS-USD' | 'SASIA-USD';

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

const DEFAULT_CURRENCY = { code: 'USD', countryCode: 'US' };
const STEAMID_REGEX = /(STEAM_[0-5]:[01]:\d+)|(\[U:[10]:\d+\])|(\d{17})/i;

export class SteamUtil {
  static readonly BP = {
    AppNews: (id: string) => SteamUtil.BP.Raw(`appnews/${id}`),
    Community: () => SteamUtil.BP.Raw('url/CommunityHome'),
    GameHub: (id: string) => SteamUtil.BP.Raw(`url/GameHub/${id}`),
    Profile: (id: string) => SteamUtil.BP.Raw(`url/SteamIDPage/${id}`),
    Raw: (path: string) => `steam://${path}`,
    Store: (id: number) => SteamUtil.BP.Raw(`store/${id}`),
    Workshop: (id: number) => SteamUtil.BP.Raw(`url/SteamWorkshopPage/${id}`),
    WorkshopItem: (id: number) => SteamUtil.BP.Raw(`url/CommunityFilePage/${id}`),
  };

  static async sendStoreEmbed(appId: number, ctx: CommandContext) {
    let currency: { code: CurrencyCode, countryCode: string } = !ctx.guildID
      ? DEFAULT_CURRENCY
      : await db.select('code', 'country_code')
        .from('currency')
        .innerJoin('guild', 'guild.currency_id', 'currency.id')
        .where('guild.id', ctx.guildID)
        .first();
    currency = currency || DEFAULT_CURRENCY;

    const details = await SteamAPI.getAppDetails(appId, currency.countryCode);
    let playerCount: number | null = null;

    if (details?.type === 'game') {
      playerCount = await SteamAPI.getNumberOfCurrentPlayers(appId!);
    }

    if (!details) {
      return ctx.error('Unable to fetch the application\'s details');
    }

    let price = details.is_free ? '**Free**' : '';
    if (!price) {
      price = details.price_overview
        ? SteamUtil.formatPriceDisplay({
          currency: currency.code,
          discount: details.price_overview.discount_percent,
          final: details.price_overview.final,
          initial: details.price_overview.initial,
        })
        : 'N/A';
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
        url: SteamUtil.getStoreUrl(appId!),
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
            value: details.categories.map((c) => c.description).join('\n'),
            inline: true,
          }] : []),
          ...(details.genres ? [{
            name: 'Genres',
            value: details.genres.map((g) => g.description).join('\n'),
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
      components: [{
        type: ComponentType.ACTION_ROW,
        components: [
          ...(details.website ? [{
            type: ComponentType.BUTTON,
            label: 'View Website',
            style: ButtonStyle.LINK,
            url: details.website,
          }] : []) as ComponentButtonLink[],
        ],
      }],
    };
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

    return appId || await SteamAPI.searchStore(id);
  }

  static async findId(id: string) {
    const match = id.match(STEAMID_REGEX);
    if (match) {
      return new SteamID(match[0]);
    }

    const urlParts = id.split('/').filter((p) => p);
    const resolvedId = await SteamAPI.resolveVanityUrl(urlParts[urlParts.length - 1]);
    return new SteamID(resolvedId!);
  }

  static getIconUrl(appId: number, icon: string) {
    return `https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/${appId}/${icon}.jpg`;
  }

  static getNewsImage(image: string) {
    return image.replace(/\{STEAM_CLAN(?:_LOC)?_IMAGE\}/, 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/clans');
  }

  static getStoreUrl(appId: number) {
    return `https://store.steampowered.com/app/${appId}`;
  }
}
