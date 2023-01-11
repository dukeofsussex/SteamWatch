// Required for type inferring
import 'knex';

import {
  App,
  AppPrice,
  ChannelWebhook,
  Currency,
  Guild,
  Patron,
  UGC,
  Watcher,
  WatcherMention,
} from './index';

declare module 'knex/types/tables' {
  interface Tables {
    app: App;
    app_price: AppPrice;
    channel_webhook: ChannelWebhook;
    currency: Currency;
    guild: Guild;
    patron: Patron;
    ugc: UGC;
    watcher: Watcher;
    watcher_mention: WatcherMention;
  }
}
