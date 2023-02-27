import { oneLine } from 'common-tags';
import { subHours } from 'date-fns';
import type { Knex } from 'knex';
import {
  App,
  db,
  EmbedBuilder,
  env,
  logger,
  SteamAPI,
  WatcherType,
} from '@steamwatch/shared';
import Watcher from './Watcher';
import type MessageQueue from '../MessageQueue';

export default class NewsWatcher extends Watcher {
  constructor(queue: MessageQueue) {
    super(queue, 10000); // 10s
  }

  protected async work() {
    const app = await NewsWatcher.fetchNextApp();

    if (!app) {
      return this.pause();
    }

    logger.info({
      message: 'Checking app news',
      app,
    });

    let news;

    try {
      news = await SteamAPI.getAppNews(app.id);
    } catch (err) {
      logger.error({
        message: 'Unable to fetch app news',
        id: app.id,
        err,
      });
    }

    await db('app').update('lastCheckedNews', new Date())
      .where('id', app.id);

    const lastCheckedMs = (app.lastCheckedNews ?? subHours(new Date(), 1)).getTime() / 1000;

    if (news && lastCheckedMs <= news.date) {
      logger.info({
        message: 'Found new article',
        news,
      });

      await this.enqueue([await EmbedBuilder.createNews(app, news)], {
        appId: app.id,
        'watcher.type': WatcherType.News,
      });
    }

    return this.wait();
  }

  private static async fetchNextApp() {
    const watcherAverage = await db.avg('count AS average')
      .from((builder: Knex.QueryBuilder) => builder.count('app_id AS count')
        .from('watcher')
        .where('watcher.type', WatcherType.News)
        .andWhere('inactive', false)
        .groupBy('app_id')
        .as('innerCount'))
      .first()
      .then((res: any) => res.average || 0);

    return db.select<App[]>(
      'app.*',
      db.raw(
        oneLine`
        watcher_count
        + (TIMESTAMPDIFF(HOUR, IFNULL(last_checked_news, UTC_TIMESTAMP() - INTERVAL 1 YEAR), UTC_TIMESTAMP()) DIV ?) * ?
        AS priority
      `,
        [env.settings.watcherRunFrequency, watcherAverage],
      ),
    ).from('app')
      .innerJoin(db.select('app_id', db.raw('COUNT(app_id) AS watcher_count')).from('watcher')
        .where('watcher.type', WatcherType.News)
        .andWhere('inactive', false)
        .groupBy('app_id')
        .as('watchers'), 'app.id', 'watchers.app_id')
      .whereRaw('last_checked_news <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)', [env.settings.watcherRunFrequency])
      .orWhereNull('last_checked_news')
      .orderBy('priority', 'desc')
      .first();
  }
}
