// Required for type inferring
import 'knex';
import { CurrencyCode } from '../steam/SteamUtil';

interface App {
  id: number;
  name: string;
  icon: string;
  type: string;
  lastCheckedNews: Date | null | undefined;
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

interface AppWatcher {
  id: number;
  appId: number;
  channelId: string;
  guildId: string;
  watchNews: boolean;
  watchPrice: boolean;
}

interface AppWatcherMention {
  id: number;
  watcherId: number;
  entityId: string;
  type: 'member' | 'role';
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

declare module 'knex/types/tables' {
  interface Tables {
    app: App;
    app_news: AppNews;
    app_price: AppPrice;
    app_watcher: AppWatcher;
    app_watcher_mention: AppWatcherMention;
    channel_webhook: ChannelWebhook;
    currency: Currency;
    guild: Guild;
  }
}
