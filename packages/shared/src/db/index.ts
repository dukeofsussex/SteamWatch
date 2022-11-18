import { knex } from 'knex';
import config from './config';
import env from '../env';
import logger from '../logger';

export type CurrencyCode = 'AED' | 'ARS' | 'AUD' | 'BRL' | 'CAD' | 'CHF'
| 'CLP' | 'CNY' | 'COP' | 'CRC' | 'EUR' | 'GBP' | 'HKD' | 'ILS'
| 'IDR' | 'INR' | 'JPY' | 'KRW' | 'KWD' | 'KZT' | 'MXN' | 'MYR'
| 'NOK' | 'NZD' | 'PEN' | 'PHP' | 'PLN' | 'QAR' | 'RUB' | 'SAR'
| 'SGD' | 'THB' | 'TRY' | 'TWD' | 'UAH' | 'USD' | 'UYU' | 'VND'
| 'ZAR' | 'CIS-USD' | 'SASIA-USD';

export interface App {
  id: number;
  name: string;
  icon: string;
  type: string;
  latestNews: string | null;
  lastCheckedNews: Date | null;
  latestUgc: string | null;
  lastCheckedUgc: Date | null;
}

export interface AppPrice {
  id: number;
  appId: number;
  currencyId: number;
  price: number;
  discountedPrice: number;
  discount: number;
  lastChecked: Date;
}

export interface ChannelWebhook {
  id: number;
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

export interface Guild {
  id: string;
  name: string;
  currencyId: number;
  lastUpdate: Date;
}

export interface UGC {
  id: string;
  appId: number;
  name: string;
  lastUpdate: Date;
  lastChecked: Date | null;
}

export interface Watcher {
  id: number;
  appId: number;
  ugcId: string;
  channelId: string;
  type: WatcherType;
}

export interface WatcherMention {
  id: number;
  watcherId: number;
  entityId: string;
  type: 'member' | 'role';
}

export enum WatcherType {
  NEWS = 'news',
  PRICE = 'price',
  UGC = 'ugc',
  WORKSHOP = 'workshop',
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
        group: 'Database',
        message,
      });
    },
    error(message: string) {
      return logger.error({
        group: 'Database',
        message,
      });
    },
    warn(message: string) {
      return logger.warn({
        group: 'Database',
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
