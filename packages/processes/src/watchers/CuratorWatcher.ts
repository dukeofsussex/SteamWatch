import { oneLine } from 'common-tags';
import type { Knex } from 'knex';
import {
  db,
  EmbedBuilder,
  env,
  Group,
  logger,
  SteamAPI,
  steamClient,
  SteamUtil,
  WatcherType,
} from '@steamwatch/shared';
import Watcher from './Watcher';
import type MessageQueue from '../MessageQueue';

export default class CuratorWatcher extends Watcher {
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

    const curator = await CuratorWatcher.fetchNextCurator();

    if (!curator) {
      return this.pause();
    }

    logger.info({
      message: 'Checking curator reviews',
      curator,
    });

    let reviews;

    try {
      reviews = await SteamAPI.getCuratorReviews(curator.id);
    } catch (err) {
      logger.error({
        message: 'Unable to fetch curator reviews',
        id: curator.id,
        err,
      });
    }

    if (reviews) {
      const index = curator.lastReviewedAppId
        ? reviews.findIndex((review) => review.appId === curator.lastReviewedAppId)
        : 1;
      reviews = reviews.slice(0, index !== -1 ? index : undefined);
    }

    if (reviews && reviews.length) {
      const apps = await steamClient.getProductInfo(reviews.map((review) => review.appId), []);
      const appExists = await db.select('id')
        .from('app')
        .where('id', reviews[0]!.appId)
        .first()
        .then((result) => !!result?.id);

      if (!appExists) {
        await SteamUtil.persistApp(reviews[0]!.appId);
      }

      await db('`group`').update({
        lastCheckedReviews: new Date(),
        lastReviewedAppId: reviews[0]!.appId,
      })
        .where('id', curator.id);

      for (let i = reviews.length - 1; i >= 0; i -= 1) {
        const review = reviews[i]!;

        logger.info({
          message: 'Found new curator review',
          review,
        });

        // eslint-disable-next-line no-await-in-loop
        await this.enqueue([EmbedBuilder.createCuratorReview(
          apps.apps[review.appId]!.appinfo.common,
          curator,
          review,
        )], {
          groupId: curator.id,
          'watcher.type': WatcherType.CURATOR,
        });
      }
    } else {
      await db('`group`').update({
        lastCheckedReviews: new Date(),
      })
        .where('id', curator.id);
    }

    return this.wait();
  }

  private static async fetchNextCurator() {
    const watcherAverage = await db.avg('count AS average')
      .from((builder: Knex.QueryBuilder) => builder.count('group_id AS count')
        .from('watcher')
        .where('watcher.type', WatcherType.CURATOR)
        .andWhere('inactive', false)
        .groupBy('group_id')
        .as('innerCount'))
      .first()
      .then((res: any) => res.average || 0);

    return db.select<Group>(
      '`group`.*',
      db.raw(
        oneLine`
        watcher_count
        + (TIMESTAMPDIFF(HOUR, IFNULL(last_checked_reviews, UTC_TIMESTAMP() - INTERVAL 1 YEAR), UTC_TIMESTAMP()) DIV ?) * ?
        AS priority
      `,
        [env.settings.watcherRunFrequency, watcherAverage],
      ),
    ).from('`group`')
      .innerJoin(db.select('group_id', db.raw('COUNT(group_id) AS watcher_count')).from('watcher')
        .where('watcher.type', WatcherType.CURATOR)
        .andWhere('inactive', false)
        .groupBy('groupId')
        .as('watchers'), 'group.id', 'watchers.group_id')
      .whereRaw('last_checked_reviews <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)', [env.settings.watcherRunFrequency])
      .orWhereNull('last_checked_reviews')
      .orderBy('priority', 'desc')
      .first();
  }
}
