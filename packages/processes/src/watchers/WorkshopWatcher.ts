import { oneLine } from 'common-tags';
import { subHours } from 'date-fns';
import type { Knex } from 'knex';
import {
  App,
  db,
  EmbedBuilder,
  env,
  logger,
  MAX_EMBEDS,
  steamClient,
  WatcherType,
} from '@steamwatch/shared';
import type { PublishedFile } from '@steamwatch/shared/src/steam/SteamWatchUser';
import Watcher from './Watcher';
import type MessageQueue from '../MessageQueue';

const MAX_FILES = MAX_EMBEDS * MAX_EMBEDS;

export default class WorkshopWatcher extends Watcher {
  constructor(queue: MessageQueue) {
    super(queue, 10000); // 10s
  }

  protected async work() {
    if (!steamClient.connected) {
      logger.info({
        message: 'Waiting for Steam connection',
      });
      return this.wait();
    }

    const app = await WorkshopWatcher.fetchNextApp();

    if (!app) {
      return this.pause();
    }

    logger.info({
      message: 'Checking workshop for new submissions',
      app,
    });

    let cursor;
    let files: PublishedFile[] = [];
    const lastCheckedMs = (app.lastCheckedUgc ?? subHours(new Date(), 1)).getTime() / 1000;
    let index = -1;

    while (files.length < MAX_FILES && index === -1) {
      let response;

      try {
        // eslint-disable-next-line no-await-in-loop
        response = await steamClient.queryFiles(app.id, cursor);
      } catch (err) {
        logger.error({
          message: 'Unable to fetch workshop submissions',
          appId: app.id,
          err,
        });
        break;
      }

      cursor = response.next_cursor;

      if (cursor === '*' || response.total === 0) {
        break;
      }

      index = response.publishedfiledetails.findIndex((file) => file.time_created <= lastCheckedMs);
      files = files.concat(
        response.publishedfiledetails.slice(0, index !== -1 ? index : undefined),
      );
    }

    await db('app').update({
      lastCheckedUgc: new Date(),
    })
      .where('id', app.id);

    for (let i = files.length - 1; i >= 0; i -= 1) {
      const file = files[i] as PublishedFile;

      if (file.banned || file.ban_reason) {
        // eslint-disable-next-line no-continue
        continue;
      }

      logger.info({
        message: 'Found new workshop submission',
        file,
      });

      this.enqueue([
        // eslint-disable-next-line no-await-in-loop
        await EmbedBuilder.createWorkshop(app, file, 'time_created'),
      ], {
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
        .andWhere('inactive', false)
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
        .andWhere('inactive', false)
        .groupBy('app_id')
        .as('watchers'), 'app.id', 'watchers.app_id')
      .whereRaw('last_checked_ugc <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)', [env.settings.watcherRunFrequency])
      .orWhereNull('last_checked_ugc')
      .orderBy('priority', 'desc')
      .first();
  }
}
