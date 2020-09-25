import { oneLine, stripIndents } from 'common-tags';
import Watcher from './Watcher';
import MessageQueue from '../MessageQueue';
import db from '../../db';
import logger from '../../logger';
import WebApi, { SteamPriceOverview } from '../../steam/WebApi';
import { insertEmoji } from '../../utils/templateTags';

import Knex = require('knex');

const PRICE_FREQUENCY = 12; // 12h
const PRICE_RATE_LIMIT = 5000; // 5s

interface AppPrice {
  icon: string;
  id: number;
  name: string;
  currencyId: number;
  currencyAbbr: string;
  currencyName: string;
  currencyCC: string;
  price: number;
  discountedPrice: number;
  discount: number;
  lastChecked: Date;
}

interface AppPriceOverview extends AppPrice {
  overview: SteamPriceOverview;
}

export default class PriceWatcher extends Watcher {
  constructor(queue: MessageQueue) {
    super(queue, PRICE_RATE_LIMIT);
  }

  protected async watchAsync() {
    const apps = await PriceWatcher.fetchNextAppPricesAsync();

    if (!apps) {
      this.retry();
      return;
    }

    let prices = null;

    try {
      prices = await WebApi.getAppPricesAsync(
        apps.map((app) => app.id),
        apps[0].currencyCC,
      );
    } catch (err) {
      logger.error({
        group: 'Watcher',
        message: err,
      });
    }

    if (!prices) {
      this.retry();
      return;
    }

    const removed: AppPrice[] = [];
    const unchanged: AppPrice[] = [];

    for (let i = 0; i < apps.length; i += 1) {
      const app = apps[i];

      if (!prices[app.id]) {
        // eslint-disable-next-line no-continue
        continue;
      }

      if (!prices[app.id].success || Array.isArray(prices[app.id].data)) {
        const message = !prices[app.id].success
          ? `No longer available in **${app.currencyAbbr}**.`
          : 'App is now free-to-play.';

        // eslint-disable-next-line no-await-in-loop
        await this.preEnqueueAsync(
          app,
          insertEmoji(stripIndents)`
            :ALERT: Price watcher removed!
            Reason: ${message}
          `,
        );

        removed.push(app);
      } else if (prices[app.id].data.price_overview.initial === app.price
          && prices[app.id].data.price_overview.discount_percent === app.discount
          && prices[app.id].data.price_overview.final === app.discountedPrice) {
        unchanged.push(app);
      } else {
        // eslint-disable-next-line no-await-in-loop
        await this.processChangesAsync(app, prices[app.id].data.price_overview);
      }
    }

    if (unchanged.length > 0) {
      const ids = unchanged.map((app) => app.id);

      await db('app_price').update({ lastChecked: new Date() })
        .whereIn('app_id', ids)
        .andWhere('currency_id', unchanged[0].currencyId);
    }

    if (removed.length > 0) {
      const ids = removed.map((app) => app.id);

      await db('app_watcher').update({
        watchPrice: false,
      })
        .whereIn('app_id', ids)
        .andWhere('watch_price', true);

      await db('app_watcher').delete()
        .whereIn('app_id', ids)
        .andWhere({
          watchNews: false,
          watchPrice: false,
        });
    }

    this.next();
  }

  private async processChangesAsync(app: AppPrice, priceOverview: SteamPriceOverview) {
    await db('app_price').update({
      price: priceOverview.initial,
      formattedPrice: priceOverview.initial_formatted
        || priceOverview.final_formatted,
      discountedPrice: priceOverview.final,
      formattedDiscountedPrice: priceOverview.final_formatted,
      discount: priceOverview.discount_percent,
      lastChecked: new Date(),
    })
      .where({
        appId: app.id,
        currencyId: app.currencyId,
      });

    let message = '';

    if (priceOverview.initial > app.price) {
      message = insertEmoji(oneLine)`
          :PRICE_UP: Base price increased to
          **${priceOverview.initial_formatted || priceOverview.final_formatted}**!
        `;
    } else if (priceOverview.initial < app.price) {
      message = insertEmoji(oneLine)`
          :PRICE_DOWN: Base price dropped to
          **${priceOverview.initial_formatted || priceOverview.final_formatted}**!
        `;
    } else if (priceOverview.discount_percent > app.discount) {
      message = insertEmoji(oneLine)`
        :ALERT: Discount:
        ~~${priceOverview.initial_formatted}~~
        **${priceOverview.final_formatted}**
        (-${priceOverview.discount_percent}%)
      `;
    }

    if (message) {
      await this.preEnqueueAsync(app, message);
    }
  }

  private async preEnqueueAsync(app: AppPrice, message: string) {
    const embed = Watcher.getEmbed(app, {
      title: `**${app.name}**`,
      description: message,
      url: WebApi.getStoreUrl(app.id),
      timestamp: new Date(),
    });

    await this.enqueueAsync(app.id, embed, 'watchPrice');
  }

  private static async fetchNextAppPricesAsync() {
    const average = await db.avg('count', { as: 'average' })
      .from(function innerCount(this: Knex) {
        this.count('app_id AS count')
          .from('app_watcher')
          .where('app_watcher.watch_price', true)
          .groupBy('app_id')
          .as('innerCount');
      })
      .first()
      .then((res: any) => res.average || 0);

    const appBaseQuery = db.select<AppPrice[]>(
      'app.id',
      'app.name',
      'app.icon',
      'guild.currency_id',
      { currencyAbbr: 'currency.abbreviation' },
      { currencyName: 'currency.name' },
      { currencyCC: 'currency.country_code' },
      'app_price.price',
      'app_price.discount',
      'app_price.discounted_price',
      'app_price.last_checked',
      db.raw(
        oneLine`
        COUNT(*)
        + (TIMESTAMPDIFF(HOUR, IFNULL(last_checked, NOW() - INTERVAL 1 YEAR), NOW()) DIV ?) * ?
        AS priority
      `,
        [PRICE_FREQUENCY, average],
      ),
    ).from('app')
      .innerJoin('app_watcher', 'app_watcher.app_id', 'app.id')
      .innerJoin('guild', 'guild.id', 'app_watcher.guild_id')
      .innerJoin('currency', 'currency.id', 'guild.currency_id')
      .innerJoin('app_price', function appPriceInnerJoin() {
        this.on('app_price.app_id', '=', 'app_watcher.app_id')
          .andOn('currency.id', '=', 'app_price.currency_id');
      })
      .whereRaw('last_checked <= DATE_SUB(NOW(), INTERVAL ? HOUR)', [PRICE_FREQUENCY])
      .orWhereNull('app_price.last_checked')
      .andWhere('app_watcher.watch_price', true)
      .groupBy('app.id', 'currency.abbreviation')
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
      .where('currency.id', currencyId)
      .limit(100);
  }
}
