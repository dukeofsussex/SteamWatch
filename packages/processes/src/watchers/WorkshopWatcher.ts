import { oneLine } from 'common-tags';
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

export default class WorkshopWatcher extends Watcher {
  constructor(queue: MessageQueue) {
    super(queue, 10000); // 10s
  }

  protected async work() {
    const app = await WorkshopWatcher.fetchNextApp();

    if (!app) {
      return this.pause();
    }

    logger.info({
      message: 'Checking workshop for new submissions',
      app,
    });

    let ugc;

    try {
      ugc = await SteamAPI.queryFiles(app.id);
    } catch (err) {
      logger.error({
        message: 'Unable to fetch workshop submissions',
        appId: app.id,
        err,
      });
    }

    await db('app').update({
      lastCheckedUgc: new Date(),
      latestUgc: ugc ? ugc.publishedfileid : app.latestUgc,
    })
      .where('id', app.id);

    if (ugc && app.latestUgc !== ugc.publishedfileid && !ugc.banned) {
      logger.info({
        message: 'Found new workshop submission',
        ugc,
      });

      await this.enqueue(await EmbedBuilder.createWorkshop(app, ugc), {
        appId: app.id,
        'watcher.type': WatcherType.WORKSHOP,
      });
    }

    return this.wait();
  }

  private static async fetchNextApp() {
    const watcherAverage = await db.avg('count AS average')
      .from((builder: Knex.QueryBuilder) => builder.count('app_id AS count')
        .from('watcher')
        .where('watcher.type', WatcherType.WORKSHOP)
        .groupBy('app_id')
        .as('innerCount'))
      .first()
      .then((res: any) => res.average || 0);

    return db.select<App>(
      'app.*',
      db.raw(
        oneLine`
          watcher_count
          + (TIMESTAMPDIFF(HOUR, IFNULL(last_checked_ugc, UTC_TIMESTAMP() - INTERVAL 1 YEAR), UTC_TIMESTAMP()) DIV ?) * ?
          AS priority
        `,
        [env.settings.watcherRunFrequency, watcherAverage],
      ),
    ).from('app')
      .innerJoin(db.select('app_id', db.raw('COUNT(app_id) AS watcher_count')).from('watcher')
        .where('watcher.type', WatcherType.WORKSHOP)
        .groupBy('app_id')
        .as('watchers'), 'app.id', 'watchers.app_id')
      .whereRaw('last_checked_ugc <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)', [env.settings.watcherRunFrequency])
      .orWhereNull('last_checked_ugc')
      .orderBy('priority', 'desc')
      .first();
  }
}
