import { knex } from 'knex';
import config from './config';
import env from '../env';
import logger from '../logger';
import type { EPublishedFileInfoMatchingFileType as EPFIMFileType } from '../steam/SteamWatchUser';

export type CurrencyCode = 'AED' | 'AUD' | 'BRL' | 'CAD' | 'CHF'
| 'CLP' | 'CNY' | 'COP' | 'CRC' | 'EUR' | 'GBP' | 'HKD' | 'ILS'
| 'IDR' | 'INR' | 'JPY' | 'KRW' | 'KWD' | 'KZT' | 'MXN' | 'MYR'
| 'NOK' | 'NZD' | 'PEN' | 'PHP' | 'PLN' | 'QAR' | 'RUB' | 'SAR'
| 'SGD' | 'THB' | 'TWD' | 'UAH' | 'USD' | 'UYU' | 'VND' | 'ZAR'
| 'CIS-USD' | 'LATAM-USD' | 'MENA-USD' | 'SASIA-USD';

export interface App {
  id: number;
  oggId: number | null;
  name: string;
  icon: string | null;
  type: AppType;
  lastCheckedNews: Date | null;
}

export enum AppType {
  Application = 'application',
  Config = 'config',
  DLC = 'dlc',
  Game = 'game',
  Hardware = 'hardware',
  Music = 'music',
  Video = 'video',
}

export interface Bundle {
  id: number;
  name: string;
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

export interface FreePackage {
  id: number;
  appId: number | null;
  type: FreePackageType | null;
  startTime: Date | null;
  endTime: Date | null;
  active: boolean;
  lastChecked: Date;
  lastUpdate: Date;
}

export enum FreePackageType {
  Promo = 'promo',
  Weekend = 'weekend',
}

export interface Forum {
  id: string;
  appId: number | null;
  groupId: number | null;
  subforumId: string;
  name: string;
  type: ForumType;
  lastChecked: Date | null;
  lastPost: Date | null;
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

export interface Price {
  id: number;
  appId: number | null;
  bundleId: number | null;
  subId: number | null;
  currencyId: number;
  price: number;
  discountedPrice: number;
  discount: number;
  lastChecked: Date;
  lastUpdate: Date;
}

export enum PriceType {
  App = 'app',
  Bundle = 'bundle',
  Sub = 'sub',
}

export interface Sub {
  id: number;
  name: string;
}

export interface UGC {
  id: string;
  appId: number;
  name: string;
  lastChecked: Date | null;
  lastUpdate: Date | null;
}

export interface Watcher {
  id: number;
  appId: number | null;
  bundleId: number | null;
  forumId: string | null;
  groupId: string | null;
  subId: number | null;
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
  type: WatcherMentionType;
}

export enum WatcherMentionType {
  Member = 'member',
  Role = 'role',
}

export enum WatcherType {
  Curator = 'curator',
  Free = 'free',
  Forum = 'forum',
  Group = 'group',
  News = 'news',
  Price = 'price',
  UGC = 'ugc',
  WorkshopNew = 'workshop_new',
  WorkshopUpdate = 'workshop_update',
}

export interface Workshop {
  id: number;
  appId: number;
  steamId: string | null;
  filetype: EPFIMFileType;
  lastCheckedNew: Date | null;
  lastNew: Date | null;
  lastCheckedUpdate: Date | null;
  lastUpdate: Date | null;
  type: WorkshopType;
}

export enum WorkshopType {
  App = 'app',
  User = 'user',
}

declare module 'knex/types/tables' {
  interface Tables {
    app: App;
    bundle: Bundle;
    channel_webhook: ChannelWebhook;
    currency: Currency;
    forum: Forum;
    free_package: FreePackage;
    group: Group;
    guild: Guild;
    patron: Patron;
    price: Price;
    sub: Sub;
    ugc: UGC;
    watcher: Watcher;
    watcher_mention: WatcherMention;
    workshop: Workshop;
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
