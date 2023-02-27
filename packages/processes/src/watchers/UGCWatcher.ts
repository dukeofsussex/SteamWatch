import { oneLine, stripIndents } from 'common-tags';
import type { Knex } from 'knex';
import { EResult } from 'steam-user';
import {
  db,
  EmbedBuilder,
  EMOJIS,
  env,
  logger,
  MAX_EMBEDS,
  steamClient,
  SteamUtil,
  transformArticle,
  UGC,
  WatcherType,
} from '@steamwatch/shared';
import Watcher from './Watcher';
import type MessageQueue from '../MessageQueue';

type QueryResult = UGC & {
  appName: string;
  appIcon: string;
};

export default class UGCWatcher extends Watcher {
  constructor(queue: MessageQueue) {
    super(queue, 10000); // 10s
  }

  protected async work() {
    if (!steamClient.connected) {
      logger.info('Waiting for Steam connection');
      return this.wait();
    }

    const ugcItems = await UGCWatcher.fetchNextUGCItems();

    if (ugcItems.length === 0) {
      return this.pause();
    }

    logger.info({
      message: 'Checking UGC for updates',
      ugcItems,
    });

    const ids = ugcItems.map((item) => parseInt(item.id, 10));
    let published;

    try {
      // Poor typings
      published = await steamClient.getPublishedFileDetails(ids) as any;
    } catch (err) {
      logger.error({
        message: 'Unable to fetch UGC details',
        ugcItems,
        err,
      });
    }

    await db('ugc').update('lastChecked', new Date())
      .whereIn('id', ids);

    if (!published || !published.files) {
      return this.wait();
    }

    const removed: string[] = [];

    for (let i = 0; i < ugcItems.length; i += 1) {
      const item = ugcItems[i] as QueryResult;
      const file = published.files[item.id];
      let message = '';

      if (!file) {
        message = stripIndents`
          ${EMOJIS.ALERT} UGC watcher removed!
          Item not found!
        `;
      } else if (file.banned) {
        message = stripIndents`
          ${EMOJIS.ALERT} UGC watcher removed!
          Item has been banned!
          Reason: ${file.ban_reason || 'Unknown'}
        `;
      } else if (file.result !== EResult.OK) {
        message = stripIndents`
          ${EMOJIS.ALERT} UGC watcher removed!
          Steam returned an invalid result: **${EResult[file.result]}**
        `;
      }

      /**
       * Watcher doesn't need to be removed and UGC up-to-date
       */
      if (!message && item.lastChecked && (item.lastChecked > new Date(file.time_updated * 1000))) {
        // eslint-disable-next-line no-continue
        continue;
      }

      if (message) {
        // eslint-disable-next-line no-await-in-loop
        await this.enqueue([
          EmbedBuilder.createApp({
            icon: item.appIcon,
            id: item.appId,
            name: item.appName,
          }, {
            description: message,
            timestamp: new Date(),
            title: item.name,
            url: SteamUtil.URLS.UGC(file.publishedfileid),
          }),
        ], {
          ugcId: item.id,
          'watcher.type': WatcherType.UGC,
        });

        removed.push(item.id);

        logger.info({
          message: message.split(' ').slice(1)
            .join(' '),
          item,
          file,
        });
      } else {
        // eslint-disable-next-line no-await-in-loop
        const changeHistory = await steamClient.getChangeHistory(
          item.id,
          item.lastChecked ? MAX_EMBEDS : 1,
        );

        const lastCheckedMs = item.lastChecked ? (item.lastChecked.getTime() / 1000) : 0;

        for (let j = changeHistory.changes.length - 1; j >= 0; j -= 1) {
          const entry = changeHistory.changes[j]!;

          if (item.lastChecked && entry.timestamp <= lastCheckedMs) {
            // eslint-disable-next-line no-continue
            continue;
          }

          // eslint-disable-next-line no-await-in-loop
          await this.enqueue([{
            // eslint-disable-next-line no-await-in-loop
            ...(await EmbedBuilder.createWorkshop(
              {
                icon: item.appIcon,
                id: item.appId,
                name: item.appName,
              },
              file,
              'time_updated',
            )),
            description: transformArticle(entry.change_description).markdown || 'No changelog',
          }], {
            ugcId: item.id,
            'watcher.type': WatcherType.UGC,
          });
        }

        // eslint-disable-next-line no-await-in-loop
        await db('ugc').update('name', file.title)
          .where('id', file.publishedfileid);

        logger.info({
          message: 'Found new UGC update',
          item,
          file,
        });
      }
    }

    if (removed.length > 0) {
      await db('ugc').delete()
        .whereIn('id', removed);
    }

    return this.wait();
  }

  private static async fetchNextUGCItems() {
    const watcherAverage = await db.avg('count AS average')
      .from((builder: Knex.QueryBuilder) => builder.count('ugc_id AS count')
        .from('watcher')
        .whereNotNull('ugcId')
        .andWhere('inactive', false)
        .groupBy('ugcId')
        .as('innerCount'))
      .first()
      .then((res: any) => res.average || 0);

    return db.select<QueryResult[]>(
      'ugc.*',
      { appName: 'app.name' },
      { appIcon: 'app.icon' },
      db.raw(
        oneLine`
        watcher_count
        + (TIMESTAMPDIFF(HOUR, IFNULL(last_checked, UTC_TIMESTAMP() - INTERVAL 1 YEAR), UTC_TIMESTAMP()) DIV ?) * ?
        AS priority
      `,
        [env.settings.watcherRunFrequency, watcherAverage],
      ),
    ).from('ugc')
      .innerJoin('app', 'ugc.app_id', 'app.id')
      .innerJoin(db.select('ugc_id', db.raw('COUNT(ugc_id) AS watcher_count')).from('watcher')
        .where('watcher.type', WatcherType.UGC)
        .andWhere('inactive', false)
        .groupBy('ugcId')
        .as('watchers'), 'ugc.id', 'watchers.ugc_id')
      .whereRaw('last_checked <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)', [env.settings.watcherRunFrequency])
      .orWhereNull('last_checked')
      .orderBy('priority', 'desc')
      .limit(25);
  }
}
