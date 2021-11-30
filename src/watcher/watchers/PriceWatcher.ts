import { oneLine, stripIndents } from 'common-tags';
import { Knex } from 'knex';
import Watcher from './Watcher';
import MessageQueue from '../MessageQueue';
import db from '../../db';
import { App, AppPrice, Currency } from '../../db/knex';
import SteamAPI, { PriceOverview } from '../../steam/SteamAPI';
import { SteamUtil } from '../../steam/SteamUtil';
import { EMOJIS } from '../../utils/constants';
import env from '../../utils/env';
import logger from '../../utils/logger';

type QueryResult = Omit<App, 'type' | 'lastCheckedNews'>
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
      this.pause();
      return;
    }

    let prices;

    try {
      prices = await SteamAPI.getAppPrices(
        apps.map((app) => app.id),
        apps[0].countryCode,
      );
    } catch (err) {
      logger.error({
        group: 'Watcher',
        message: `Unable to fetch app prices for [${apps.join(', ')}] in ${apps[0].currencyName}!`,
        err,
      });
    }

    if (!prices) {
      this.pause();
      return;
    }

    const removed: QueryResult[] = [];
    const unchanged: QueryResult[] = [];

    for (let i = 0; i < apps.length; i += 1) {
      const app = apps[i];

      if (!prices[app.id]) {
        // eslint-disable-next-line no-continue
        continue;
      }

      if (!prices[app.id].success || Array.isArray(prices[app.id].data)) {
        const message = !prices[app.id].success
          ? `No longer available in **${app.code}**.`
          : 'App is now free-to-play.';

        // eslint-disable-next-line no-await-in-loop
        await this.preEnqueue(
          app,
          stripIndents`
            ${EMOJIS.ALERT} Price watcher removed!
            Reason: ${message}
          `,
        );

        removed.push(app);
      } else if (prices[app.id].data.price_overview!.initial === app.price
          && prices[app.id].data.price_overview!.discount_percent === app.discount
          && prices[app.id].data.price_overview!.final === app.discountedPrice) {
        unchanged.push(app);
      } else {
        // eslint-disable-next-line no-await-in-loop
        await this.processChanges(app, prices[app.id].data.price_overview!);
      }
    }

    if (unchanged.length > 0) {
      await db('app_price').update({ lastChecked: new Date() })
        .whereIn('app_id', unchanged.map((app) => app.id))
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

      await db('app_price').delete()
        .whereIn('appId', ids);
    }

    this.wait();
  }

  private async processChanges(app: QueryResult, priceOverview: PriceOverview) {
    await db('app_price').update({
      price: priceOverview.initial,
      discountedPrice: priceOverview.final,
      discount: priceOverview.discount_percent,
      lastChecked: new Date(),
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
      await this.preEnqueue(app, message);
    }
  }

  private async preEnqueue(app: QueryResult, message: string) {
    const embed = Watcher.getEmbed(app, {
      title: app.name,
      description: message,
      url: SteamUtil.getStoreUrl(app.id),
      timestamp: new Date(),
    });

    embed.fields = [{
      name: 'Steam Client Link',
      value: SteamUtil.BP.Store(app.id),
    }];

    const watchers = await db.select(
      'app_watcher.id',
      'entity_id',
      'type',
      'webhook_id',
      'webhook_token',
    ).from('app_watcher')
      .leftJoin('app_watcher_mention', 'app_watcher_mention.watcher_id', 'app_watcher.id')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'app_watcher.channel_id')
      .innerJoin('guild', 'guild.id', 'app_watcher.guild_id')
      .where({
        appId: app.id,
        currencyId: app.currencyId,
        watchPrice: true,
      });

    await this.enqueue(watchers, embed);
  }

  private static async fetchNextAppPrices() {
    const average = await db.avg('count', { as: 'average' })
      .from((builder: Knex.QueryBuilder) => builder.count('app_id AS count')
        .from('app_watcher')
        .where('app_watcher.watch_price', true)
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
      .innerJoin('app_watcher', 'app_watcher.app_id', 'app.id')
      .innerJoin('guild', 'guild.id', 'app_watcher.guild_id')
      .innerJoin('currency', 'currency.id', 'guild.currency_id')
      .innerJoin('app_price', function appPriceInnerJoin() {
        this.on('app_price.app_id', '=', 'app.id')
          .andOn('currency.id', '=', 'app_price.currency_id');
      })
      .where((builder) => builder.where((innerBuilder) => innerBuilder.where('app_watcher.watch_price', true)
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
