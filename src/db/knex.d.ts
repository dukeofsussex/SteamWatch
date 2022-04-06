// Required for type inferring
import 'knex';
import { WatcherType } from '../types';

type CurrencyCode = 'AED' | 'ARS' | 'AUD' | 'BRL' | 'CAD' | 'CHF'
| 'CLP' | 'CNY' | 'COP' | 'CRC' | 'EUR' | 'GBP' | 'HKD' | 'ILS'
| 'IDR' | 'INR' | 'JPY' | 'KRW' | 'KWD' | 'KZT' | 'MXN' | 'MYR'
| 'NOK' | 'NZD' | 'PEN' | 'PHP' | 'PLN' | 'QAR' | 'RUB' | 'SAR'
| 'SGD' | 'THB' | 'TRY' | 'TWD' | 'UAH' | 'USD' | 'UYU' | 'VND'
| 'ZAR' | 'CIS-USD' | 'SASIA-USD';

interface App {
  id: number;
  name: string;
  icon: string;
  type: string;
  lastCheckedNews: Date | null;
  latestUgc: string | null;
  lastCheckedUgc: Date | null;
}

interface AppNews {
  id: number;
  appId: number;
  gid: string;
  title: string;
  markdown: string;
  thumbnail: string | null;
  url: string;
  createdAt: Date;
}

interface AppPrice {
  id: number;
  appId: number;
  currencyId: number;
  price: number;
  discountedPrice: number;
  discount: number;
  lastChecked: Date;
}

interface ChannelWebhook {
  id: number;
  guildId: string;
  webhookId: string;
  webhookToken: string;
}

interface Currency {
  id: number;
  name: string;
  code: CurrencyCode;
  countryCode: string;
}

interface Guild {
  id: string;
  name: string;
  currencyId: number;
  lastUpdate: Date;
}

interface UGC {
  id: string;
  appId: number;
  name: string;
  lastUpdate: Date;
  lastChecked: Date | null;
}

interface Watcher {
  id: number;
  appId: number;
  ugcId: string;
  channelId: string;
  type: WatcherType;
}

interface WatcherMention {
  id: number;
  watcherId: number;
  entityId: string;
  type: 'member' | 'role';
}

declare module 'knex/types/tables' {
  interface Tables {
    app: App;
    app_news: AppNews;
    app_price: AppPrice;
    channel_webhook: ChannelWebhook;
    currency: Currency;
    guild: Guild;
    ugc: UGC;
    watcher: Watcher;
    watcher_mention: WatcherMention;
  }
}
