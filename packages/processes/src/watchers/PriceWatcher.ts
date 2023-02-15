import { oneLine, stripIndents } from 'common-tags';
import { addDays } from 'date-fns';
import type { Knex } from 'knex';
import {
  App,
  AppPrice,
  Currency,
  db,
  EmbedBuilder,
  EMOJIS,
  env,
  logger,
  PriceOverview,
  SteamAPI,
  SteamUtil,
  WatcherType,
} from '@steamwatch/shared';
import Watcher from './Watcher';
import type MessageQueue from '../MessageQueue';

type QueryResult = Pick<App, 'icon' | 'id' | 'name'>
& Pick<Currency, 'code' | 'countryCode'>
& Omit<AppPrice, 'id' | 'appId'>
& { currencyName: string };

export default class PriceWatcher extends Watcher {
  constructor(queue: MessageQueue) {
    super(queue, 10000); // 10s
  }

  protected async work() {
    const apps = await PriceWatcher.fetchNextAppPrices();

    if (!apps) {
      return this.pause();
    }

    logger.info({
      message: 'Checking app prices',
      apps,
    });

    let prices;

    try {
      prices = await SteamAPI.getAppPrices(
        apps.map((app) => app.id),
        apps[0]!.countryCode,
      );
    } catch (err) {
      logger.error({
        message: 'Unable to fetch app prices',
        currency: apps[0]!.currencyName,
        apps,
        err,
      });
    }

    if (!prices) {
      return this.wait();
    }

    const removed: QueryResult[] = [];
    const unchanged: QueryResult[] = [];

    for (let i = 0; i < apps.length; i += 1) {
      const app = apps[i] as QueryResult;

      if (!prices[app!.id]) {
        // eslint-disable-next-line no-continue
        continue;
      }

      if (!prices[app.id]!.success || Array.isArray(prices[app.id]!.data)) {
        const message = !prices[app.id]!.success
          ? `No longer available in **${app.code}**.`
          : 'App is now free-to-play.';

        logger.info({
          message: `Price watcher removed! Reason: ${message}`,
          app,
          priceOverview: prices[app.id]!.data.price_overview!,
        });

        // eslint-disable-next-line no-await-in-loop
        await this.preEnqueue(
          app,
          stripIndents`
            ${EMOJIS.ALERT} Price watcher removed!
            Reason: ${message}
          `,
        );

        removed.push(app);
      } else if (prices[app.id]!.data.price_overview!.initial === app.price
          && prices[app.id]!.data.price_overview!.discount_percent === app.discount
          && prices[app.id]!.data.price_overview!.final === app.discountedPrice) {
        unchanged.push(app);
      } else {
        // eslint-disable-next-line no-await-in-loop
        await this.processChanges(app, prices[app.id]!.data.price_overview!);
      }
    }

    if (unchanged.length > 0) {
      await db('app_price').update({ lastChecked: new Date() })
        .whereIn('app_id', unchanged.map((app) => app.id))
        .andWhere('currency_id', unchanged[0]!.currencyId);
    }

    if (removed.length > 0) {
      const ids = removed.map((app) => app.id);

      await db('watcher').delete()
        .whereIn('app_id', ids)
        .andWhere('type', WatcherType.PRICE);

      await db('app_price').delete()
        .whereIn('appId', ids);
    }

    return this.wait();
  }

  private async processChanges(app: QueryResult, priceOverview: PriceOverview) {
    await db('app_price').update({
      price: priceOverview.initial,
      discountedPrice: priceOverview.final,
      discount: priceOverview.discount_percent,
      lastChecked: addDays(new Date(), 1),
    })
      .where({
        appId: app.id,
        currencyId: app.currencyId,
      });

    let message = '';

    if (priceOverview.initial > app.price) {
      message = oneLine`
          ${EMOJIS.PRICE_UP} Base price increased from
          **${SteamUtil.formatPrice(app.price, app.code)}**
          to
          **${SteamUtil.formatPrice(priceOverview.initial, app.code)}**!
        `;
    } else if (priceOverview.initial < app.price) {
      message = oneLine`
          ${EMOJIS.PRICE_DOWN} Base price dropped from
          **${SteamUtil.formatPrice(app.price, app.code)}**
          to
          **${SteamUtil.formatPrice(priceOverview.initial, app.code)}**!
        `;
    } else if (priceOverview.discount_percent > app.discount) {
      const price = SteamUtil.formatPriceDisplay({
        currency: app.code,
        discount: priceOverview.discount_percent,
        final: priceOverview.final,
        initial: priceOverview.initial,
      });
      message = `${EMOJIS.ALERT} Discount: ${price}`;
    }

    if (message) {
      logger.info({
        message: `Found new price! ${message.split(' ').slice(1)
          .join(' ')}`,
        app,
        priceOverview,
      });
      await this.preEnqueue(app, message);
    }
  }

  private async preEnqueue(app: QueryResult, message: string) {
    const embed = EmbedBuilder.createApp(app, {
      title: app.name,
      description: message,
      url: SteamUtil.URLS.Store(app.id),
      timestamp: new Date(),
    });

    embed.fields = [{
      name: 'Steam Client Link',
      value: SteamUtil.BP.Store(app.id),
    }];

    await this.enqueue([embed], {
      appId: app.id,
      currencyId: app.currencyId,
      'watcher.type': WatcherType.PRICE,
    });
  }

  private static async fetchNextAppPrices() {
    const average = await db.avg('count AS average')
      .from((builder: Knex.QueryBuilder) => builder.count('app_id AS count')
        .from('watcher')
        .where('watcher.type', WatcherType.PRICE)
        .andWhere('inactive', false)
        .groupBy('app_id')
        .as('innerCount'))
      .first()
      .then((res: any) => res.average || 0);

    const appBaseQuery = db.select<QueryResult[]>(
      'app.id',
      'app.name',
      'app.icon',
      'currency.code',
      { currencyName: 'currency.name' },
      'currency.country_code',
      'app_price.currency_id',
      'app_price.price',
      'app_price.discount',
      'app_price.discounted_price',
      'app_price.last_checked',
      db.raw(
        oneLine`
        COUNT(*)
        + (TIMESTAMPDIFF(HOUR, IFNULL(last_checked, UTC_TIMESTAMP() - INTERVAL 1 YEAR), UTC_TIMESTAMP()) DIV ?) * ?
        AS priority
      `,
        [env.settings.watcherRunFrequency, average],
      ),
    ).from('app')
      .innerJoin('watcher', 'watcher.app_id', 'app.id')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
      .innerJoin('guild', 'guild.id', 'channel_webhook.guild_id')
      .innerJoin('currency', 'currency.id', 'guild.currency_id')
      .innerJoin('app_price', (builder) => builder.on('app_price.app_id', 'app.id')
        .andOn('currency.id', 'app_price.currency_id'))
      .where((builder) => builder.where((innerBuilder) => innerBuilder.where('watcher.type', WatcherType.PRICE)
        .andWhere('inactive', false)
        .andWhereRaw('last_checked <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)', [env.settings.watcherRunFrequency]))
        .orWhereNull('app_price.last_checked'))
      .groupBy('app.id', 'currency.code')
      .orderBy('priority', 'desc');

    const currencyId = await appBaseQuery
      .clone()
      .first()
      .then((res: any) => res?.currencyId || 0);

    if (currencyId === 0) {
      return null;
    }

    return appBaseQuery
      .clone()
      .andWhere('currency.id', currencyId)
      .limit(100);
  }
}
