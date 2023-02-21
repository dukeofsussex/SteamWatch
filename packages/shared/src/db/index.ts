import { knex } from 'knex';
import config from './config';
import env from '../env';
import logger from '../logger';
import type { EPublishedFileInfoMatchingFileType } from '../steam/SteamWatchUser';

export type CurrencyCode = 'AED' | 'ARS' | 'AUD' | 'BRL' | 'CAD' | 'CHF'
| 'CLP' | 'CNY' | 'COP' | 'CRC' | 'EUR' | 'GBP' | 'HKD' | 'ILS'
| 'IDR' | 'INR' | 'JPY' | 'KRW' | 'KWD' | 'KZT' | 'MXN' | 'MYR'
| 'NOK' | 'NZD' | 'PEN' | 'PHP' | 'PLN' | 'QAR' | 'RUB' | 'SAR'
| 'SGD' | 'THB' | 'TRY' | 'TWD' | 'UAH' | 'USD' | 'UYU' | 'VND'
| 'ZAR' | 'CIS-USD' | 'SASIA-USD';

export interface App {
  id: number;
  oggId: number | null;
  name: string;
  icon: string;
  type: string;
  lastCheckedNews: Date | null;
}

export interface AppPrice {
  id: number;
  appId: number;
  currencyId: number;
  price: number;
  discountedPrice: number;
  discount: number;
  lastChecked: Date | null;
}

export interface AppWorkshop {
  id: number;
  appId: number;
  filetype: EPublishedFileInfoMatchingFileType;
  lastCheckedNew: Date | null;
  lastCheckedUpdate: Date | null;
}

export interface ChannelWebhook {
  id: string;
  guildId: string;
  webhookId: string;
  webhookToken: string;
}

export interface Currency {
  id: number;
  name: string;
  code: CurrencyCode;
  countryCode: string;
}

export interface Forum {
  id: string;
  appId: number | null;
  groupId: number | null;
  subforumId: string;
  name: string;
  type: ForumType;
  lastChecked: Date | null;
}

export enum ForumType {
  Event = 'event',
  General = 'general',
  PublishedFile = 'publishedfile',
  Trading = 'trading',
  Workshop = 'workshop',
}

export interface Group {
  id: number;
  name: string;
  avatar: string;
  vanityUrl: string;
  lastCheckedNews: Date | null;
  lastReviewedAppId: number | null;
  lastCheckedReviews: Date | null;
}

export interface Guild {
  id: string;
  name: string;
  currencyId: number | null;
  customWebhookName: string | null;
  customWebhookAvatar: string | null;
  lastUpdate: Date;
}

export interface Patron {
  id: number;
  discordId: string | null;
  email: string;
  pledgeAmountCents: number;
  pledgeTier: number;
  guildId: string | null;
}

export interface UGC {
  id: string;
  appId: number;
  name: string;
  lastChecked: Date | null;
}

export interface Watcher {
  id: number;
  appId: number | null;
  forumId: string | null;
  ugcId: string | null;
  workshopId: number | null;
  channelId: string;
  threadId: string | null;
  type: WatcherType;
  inactive: boolean;
}

export interface WatcherMention {
  id: number;
  watcherId: number;
  entityId: string;
  type: 'member' | 'role';
}

export enum WatcherType {
  Curator = 'curator',
  Forum = 'forum',
  Group = 'group',
  News = 'news',
  Price = 'price',
  UGC = 'ugc',
  WorkshopNew = 'workshop_new',
  WorkshopUpdate = 'workshop_update',
}

declare module 'knex/types/tables' {
  interface Tables {
    app: App;
    app_price: AppPrice;
    app_workshop: AppWorkshop;
    channel_webhook: ChannelWebhook;
    currency: Currency;
    forum: Forum;
    group: Group;
    guild: Guild;
    patron: Patron;
    ugc: UGC;
    watcher: Watcher;
    watcher_mention: WatcherMention;
  }
}

const convertCamelToSnake = (value: string) => value.replace(/[A-Z]/g, (char: string) => `_${char.toLowerCase()}`);

const convertSnakeToCamel = (value: string) => value.replace(/([-_]\w)/g, (char: string) => char[1]!.toUpperCase());

const postProcessRow = (row: any): any => {
  if (typeof row !== 'object' || row === null) {
    return row;
  }

  return Object.entries(row).reduce((result, [key, value]) => ({
    ...result,
    [convertSnakeToCamel(key)]: value,
  }), {});
};

export default knex({
  ...config,
  asyncStackTraces: env.dev,
  debug: env.debug,
  log: {
    debug(message: string) {
      return logger.debug({
        label: 'Database:debug',
        message,
      });
    },
    error(message: string) {
      return logger.error({
        label: 'Database:error',
        message,
      });
    },
    warn(message: string) {
      return logger.warn({
        label: 'Database:warn',
        message,
      });
    },
  },
  postProcessResponse: (result) => {
    if (Array.isArray(result)) {
      return result.map((row) => postProcessRow(row));
    }

    if (result) {
      return postProcessRow(result);
    }

    return result;
  },
  wrapIdentifier: (value: string) => convertCamelToSnake(value),
});
