import { oneLine, stripIndents } from 'common-tags';
import { addDays, subDays } from 'date-fns';
import type { Knex } from 'knex';
import {
  App,
  Currency,
  db,
  EmbedBuilder,
  EMOJIS,
  env,
  logger,
  Price,
  PriceDisplay,
  PriceType,
  SteamUtil,
  WatcherType,
} from '@steamwatch/shared';
import Watcher from './Watcher';
import type MessageQueue from '../MessageQueue';

const BATCH_SIZE = 100;

type StorePrices = Record<number, Omit<PriceDisplay, 'currency'> | null>;

type QueryResult = Pick<App, 'icon' | 'id' | 'name'>
& Pick<Currency, 'code' | 'countryCode'>
& Omit<Price, 'id' | 'appId' | 'bundleId' | 'subId'>
& {
  type: PriceType;
};

export default class PriceWatcher extends Watcher {
  constructor(queue: MessageQueue) {
    super(queue, 10000); // 10s
  }

  protected async work() {
    const items = await PriceWatcher.fetchNextPrices();

    if (items.length === 0) {
      return this.pause();
    }

    logger.info({
      message: 'Checking prices',
      items,
    });

    const ids = items.map((item) => item.id);
    const key = SteamUtil.getPriceTypeIdKey(items[0]!.type);

    let prices: StorePrices = {};

    try {
      prices = await SteamUtil.getStorePrices(
        ids,
        items[0]!.type,
        items[0]!.code,
        items[0]!.countryCode,
      );
    } catch (err) {
      logger.error({
        message: 'Unable to fetch prices',
        currency: items[0]!.code,
        items,
        err,
      });
    }

    await db('price').update('lastChecked', new Date())
      .whereIn(key, ids)
      .andWhere('currency_id', items[0]!.currencyId);

    if (!Object.keys(prices).length) {
      return this.wait();
    }

    const fn = items[0]!.type === PriceType.App
      ? this.processAppPrices.bind(this)
      : this.processNonAppPrices.bind(this);

    const [unchanged, removed] = await fn(items, prices);

    if (unchanged!.length > 0) {
      await db('price').update('lastUpdate', new Date())
        .whereIn(key, unchanged!)
        .andWhere('currency_id', items[0]!.currencyId);
    }

    if (removed!.length > 0) {
      await db('watcher').delete()
        .whereIn(key, removed!)
        .andWhere('type', WatcherType.Price);

      await db('price').delete()
        .whereIn(key, removed!);
    }

    return this.wait();
  }

  private async processAppPrices(apps: QueryResult[], prices: StorePrices) {
    const unchanged: number[] = [];
    const removed: number[] = [];

    for (let i = 0; i < apps.length; i += 1) {
      const app = apps[i]!;
      const price = prices[app.id];

      if (!price) {
        // eslint-disable-next-line no-continue
        continue;
      }

      // Only remove a price watcher if we haven't received an update for 3 or more days
      if ((!price && app.lastUpdate < subDays(new Date(), 3))
          || price.final === 0) {
        const message = !price
          ? `No longer available in **${app.code}**.`
          : 'App is now free-to-play.';

        logger.info({
          message: `Price watcher removed! Reason: ${message}`,
          app,
          price,
        });

        // eslint-disable-next-line no-await-in-loop
        await this.preEnqueue(
          app,
          stripIndents`
            ${EMOJIS.ALERT} Price watcher removed!
            Reason: ${message}
          `,
        );

        removed.push(app.id!);
      } else if (price.initial === app.price
          && price.discount === app.discount
          && price.final === app.discountedPrice) {
        unchanged.push(app.id!);
      } else {
        // eslint-disable-next-line no-await-in-loop
        await this.processChanges(app, price);
      }
    }

    return [unchanged, removed];
  }

  private async processNonAppPrices(items: QueryResult[], prices: StorePrices) {
    const unchanged: number[] = [];

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]!;
      const price = prices[item.id];

      if (!price) {
        // eslint-disable-next-line no-continue
        continue;
      }

      if (price.initial === item.price
          && price.discount === item.discount
          && price.final === item.discountedPrice) {
        unchanged.push(item.id!);
      } else {
        // eslint-disable-next-line no-await-in-loop
        await this.processChanges(item, price);
      }
    }

    return [unchanged, []];
  }

  private async processChanges(item: QueryResult, price: Omit<PriceDisplay, 'currency'>) {
    await db('price').update({
      price: price.initial,
      discountedPrice: price.final,
      discount: price.discount,
      lastChecked: addDays(new Date(), 1),
      lastUpdate: addDays(new Date(), 1),
    })
      .where({
        [SteamUtil.getPriceTypeIdKey(item.type)]: item.id,
        currencyId: item.currencyId,
      });

    let message = '';

    if (price.initial > item.price) {
      message = oneLine`
          ${EMOJIS.PRICE_UP} Base price increased from
          **${SteamUtil.formatPrice(item.price, item.code)}**
          to
          **${SteamUtil.formatPrice(price.initial, item.code)}**!
        `;
    } else if (price.initial < item.price) {
      message = oneLine`
          ${EMOJIS.PRICE_DOWN} Base price dropped from
          **${SteamUtil.formatPrice(item.price, item.code)}**
          to
          **${SteamUtil.formatPrice(price.initial, item.code)}**!
        `;
    } else if (price.discount > item.discount) {
      const formattedPrice = SteamUtil.formatPriceDisplay({
        currency: item.code,
        ...price,
      });
      message = `${EMOJIS.ALERT} Discount: ${formattedPrice}`;
    }

    if (message) {
      logger.info({
        message: `Found new price! ${message.split(' ').slice(1)
          .join(' ')}`,
        app: item,
        price,
      });
      await this.preEnqueue(item, message);
    }
  }

  private async preEnqueue(item: QueryResult, message: string) {
    await this.enqueue([EmbedBuilder.createStoreItem(item, message)], {
      appId: item.id,
      currencyId: item.currencyId,
      'watcher.type': WatcherType.Price,
    });
  }

  private static async fetchNextPrices() {
    const average = await db.avg('count AS average')
      .from((builder: Knex.QueryBuilder) => builder.count('* AS count')
        .from('watcher')
        .where('watcher.type', WatcherType.Price)
        .andWhere('inactive', false)
        .groupBy('app_id', 'bundle_id', 'sub_id')
        .as('innerCount'))
      .first()
      .then((res: any) => res.average || 0);

    const appBaseQuery = db.select(
      'app.icon',
      'currency.code',
      'currency.country_code',
      'price.currency_id',
      'price.price',
      'price.discount',
      'price.discounted_price',
      'price.last_checked',
      db.raw(oneLine`
        CASE
          WHEN watcher.bundle_id IS NOT NULL THEN bundle.id
          WHEN watcher.sub_id IS NOT NULL THEN sub.id
          ELSE app.id
        END AS id
      `),
      db.raw(oneLine`
        CASE
          WHEN watcher.bundle_id IS NOT NULL THEN bundle.name
          WHEN watcher.sub_id IS NOT NULL THEN sub.name
          ELSE app.name
        END AS name
      `),
      db.raw(oneLine`
        CASE
          WHEN watcher.bundle_id IS NOT NULL THEN "bundle"
          WHEN watcher.sub_id IS NOT NULL THEN "sub"
          ELSE "app"
        END AS type
      `),
      db.raw(
        oneLine`
        COUNT(*)
        + (TIMESTAMPDIFF(HOUR, last_checked, UTC_TIMESTAMP()) DIV ?) * ?
        AS priority
      `,
        [env.settings.watcherRunFrequency, average],
      ),
    ).from('watcher')
      .leftJoin('app', 'app.id', 'watcher.app_id')
      .leftJoin('bundle', 'bundle.id', 'watcher.bundle_id')
      .leftJoin('sub', 'sub.id', 'watcher.sub_id')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
      .innerJoin('guild', 'guild.id', 'channel_webhook.guild_id')
      .innerJoin('currency', 'currency.id', 'guild.currency_id')
      .innerJoin('price', (builder) => builder.on(
        (innerBuilder) => innerBuilder.on('price.app_id', 'watcher.app_id')
          .orOn('price.bundle_id', 'watcher.bundle_id')
          .orOn('price.sub_id', 'watcher.sub_id'),
      ).andOn('currency.id', 'price.currency_id'))
      .where((builder) => builder.where('watcher.type', WatcherType.Price)
        .andWhere('inactive', false)
        .andWhereRaw('last_checked <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)', [env.settings.watcherRunFrequency]))
      .groupBy('watcher.app_id', 'watcher.bundle_id', 'watcher.sub_id', 'currency.code')
      .orderBy('priority', 'desc');

    const res = await appBaseQuery
      .clone()
      .first() as QueryResult;

    if (!res) {
      return [];
    }

    return appBaseQuery
      .clone()
      .andWhereRaw('watcher.?? IS NOT NULL', SteamUtil.getPriceTypeIdKey(res.type))
      .andWhere('currency.id', res.currencyId)
      .limit(BATCH_SIZE) as Promise<QueryResult[]>;
  }
}
