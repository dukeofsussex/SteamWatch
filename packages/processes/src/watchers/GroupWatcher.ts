import { oneLine } from 'common-tags';
import { subHours } from 'date-fns';
import type { Knex } from 'knex';
import {
  db,
  EmbedBuilder,
  env,
  Group,
  logger,
  SteamAPI,
  WatcherType,
} from '@steamwatch/shared';
import Watcher from './Watcher';
import type MessageQueue from '../MessageQueue';

export default class GroupWatcher extends Watcher {
  constructor(queue: MessageQueue) {
    super(queue, 10000); // 10s
  }

  protected async work() {
    const group = await GroupWatcher.fetchNextGroup();

    if (!group) {
      return this.pause();
    }

    logger.info({
      message: 'Checking group news',
      group,
    });

    let news;

    try {
      news = await SteamAPI.getGroupNews(group.id);
    } catch (err) {
      logger.error({
        message: 'Unable to fetch group news',
        id: group.id,
        err,
      });
    }

    await db('`group`').update({
      lastCheckedNews: new Date(),
    })
      .where('id', group.id);

    const lastCheckedMs = (group.lastCheckedNews ?? subHours(new Date(), 1)).getTime() / 1000;

    if (news && !news.banned && lastCheckedMs <= news.posttime) {
      logger.info({
        message: 'Found new group post',
        news,
      });

      await this.enqueue([await EmbedBuilder.createGroupNews(group, news)], {
        groupId: group.id,
        'watcher.type': WatcherType.GROUP,
      });
    }

    return this.wait();
  }

  private static async fetchNextGroup() {
    const watcherAverage = await db.avg('count AS average')
      .from((builder: Knex.QueryBuilder) => builder.count('group_id AS count')
        .from('watcher')
        .where('watcher.type', WatcherType.GROUP)
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
        + (TIMESTAMPDIFF(HOUR, IFNULL(last_checked_news, UTC_TIMESTAMP() - INTERVAL 1 YEAR), UTC_TIMESTAMP()) DIV ?) * ?
        AS priority
      `,
        [env.settings.watcherRunFrequency, watcherAverage],
      ),
    ).from('`group`')
      .innerJoin(db.select('group_id', db.raw('COUNT(group_id) AS watcher_count')).from('watcher')
        .where('watcher.type', WatcherType.GROUP)
        .andWhere('inactive', false)
        .groupBy('groupId')
        .as('watchers'), 'group.id', 'watchers.group_id')
      .whereRaw('last_checked_news <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)', [env.settings.watcherRunFrequency])
      .orWhereNull('last_checked_news')
      .orderBy('priority', 'desc')
      .first();
  }
}
