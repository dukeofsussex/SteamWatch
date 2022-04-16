import { oneLine } from 'common-tags';
import { Knex } from 'knex';
import Watcher from './Watcher';
import db from '../../db';
import { App } from '../../db/knex';
import SteamAPI from '../../steam/SteamAPI';
import { WatcherType } from '../../types';
import EmbedBuilder from '../../utils/EmbedBuilder';
import env from '../../utils/env';
import logger from '../../utils/logger';
import MessageQueue from '../../utils/MessageQueue';

export default class NewsWatcher extends Watcher {
  constructor(queue: MessageQueue) {
    super(queue, 10000); // 10s
  }

  protected async work() {
    const app = await NewsWatcher.fetchNextApp();

    if (!app) {
      return this.pause();
    }

    let news;

    try {
      news = await SteamAPI.getAppNews(app.id);
    } catch (err) {
      logger.error({
        group: 'Watcher',
        message: `Unable to fetch app news for ${app.id}!`,
        err,
      });
    }

    await db('app').update({
      lastCheckedNews: new Date(),
      latestNews: news ? news.gid : app.latestNews,
    })
      .where('id', app.id);

    if (!news) {
      return this.wait();
    }

    if (app.latestNews === news.gid) {
      return this.pause();
    }

    await this.enqueue(EmbedBuilder.createNews(app, news), {
      appId: app.id,
      'watcher.type': WatcherType.NEWS,
    });

    return this.wait();
  }

  private static async fetchNextApp() {
    const watcherAverage = await db.avg('count AS average')
      .from((builder: Knex.QueryBuilder) => builder.count('app_id AS count')
        .from('watcher')
        .where('watcher.type', WatcherType.NEWS)
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
        .where('watcher.type', WatcherType.NEWS)
        .groupBy('app_id')
        .as('watchers'), 'app.id', 'watchers.app_id')
      .whereRaw('last_checked_news <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)', [env.settings.watcherRunFrequency])
      .orWhereNull('last_checked_news')
      .orderBy('priority', 'desc')
      .first();
  }
}
