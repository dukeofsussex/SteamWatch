import { oneLine, stripIndents } from 'common-tags';
import { Knex } from 'knex';
import { EResult } from 'steam-user';
import Watcher from './Watcher';
import MessageQueue from '../MessageQueue';
import db from '../../db';
import { UGC } from '../../db/knex';
import SteamAPI from '../../steam/SteamAPI';
import { WatcherType } from '../../types';
import { EMOJIS } from '../../utils/constants';
import EmbedBuilder from '../../utils/EmbedBuilder';
import env from '../../utils/env';
import logger from '../../utils/logger';

type QueryResult = UGC & {
  appName: string;
  appIcon: string;
};

export default class UGCWatcher extends Watcher {
  constructor(queue: MessageQueue) {
    super(queue, 10000); // 10s
  }

  protected async work() {
    const ugcItems = await UGCWatcher.fetchNextUGCItems();

    if (ugcItems.length === 0) {
      return this.pause();
    }

    let published;

    try {
      published = await SteamAPI.getPublishedFileDetails(ugcItems.map((item) => item.id));
    } catch (err) {
      logger.error({
        group: 'Watcher',
        message: 'Unable to fetch published file details!',
        ugcItems,
        err,
      });
    }

    if (!published) {
      return this.wait();
    }

    const removed: string[] = [];
    const unchanged: string[] = [];

    for (let i = 0; i < ugcItems.length; i += 1) {
      const item = ugcItems[i];
      const file = published.find((pItem) => pItem.publishedfileid === item.id);
      let message = '';

      if (!file) {
        message = stripIndents`
          ${EMOJIS.ALERT} UGC watcher removed!
          Item not found!
        `;
        removed.push(item.id);
      } else if (file.banned) {
        message = stripIndents`
          ${EMOJIS.ALERT} UGC watcher removed!
          Item has been banned!
          Reason: ${file.ban_reason || 'Unknown'}
        `;
        removed.push(item.id);
      } else if (file.result !== EResult.OK) {
        message = stripIndents`
          ${EMOJIS.ALERT} UGC watcher removed!
          Steam returned an invalid result: ${EResult[file.result]}
        `;
        removed.push(item.id);
      } else if (new Date(file.time_updated * 1000) > item.lastUpdate) {
        message = `${EMOJIS.TADA} Item has been updated!`;
        item.lastUpdate = new Date(file.time_updated * 1000);

        // eslint-disable-next-line no-await-in-loop
        await db('ugc').update({
          lastChecked: new Date(),
          lastUpdate: item.lastUpdate,
          name: file.title,
        })
          .where('id', file.publishedfileid);
      } else {
        unchanged.push(item.id);
      }

      if (message) {
        // eslint-disable-next-line no-await-in-loop
        const embed = await EmbedBuilder.createWorkshop({
          icon: item.appIcon,
          id: item.appId,
          name: item.appName,
        }, file!);

        embed.description = message;

        // eslint-disable-next-line no-await-in-loop
        await this.enqueue(embed, {
          ugcId: item.id,
          'watcher.type': WatcherType.UGC,
        });
      }
    }

    if (removed.length > 0) {
      await db('ugc').delete()
        .whereIn('id', removed);
    }

    if (unchanged.length > 0) {
      await db('ugc').update('lastChecked', new Date())
        .whereIn('id', published.map((item) => item.publishedfileid));
    }

    return this.wait();
  }

  private static async fetchNextUGCItems() {
    const watcherAverage = await db.avg('count AS average')
      .from((builder: Knex.QueryBuilder) => builder.count('ugc_id AS count')
        .from('watcher')
        .whereNotNull('ugcId')
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
        .whereNotNull('ugcId')
        .groupBy('ugcId')
        .as('watchers'), 'ugc.id', 'watchers.ugc_id')
      .whereRaw('last_checked <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)', [env.settings.watcherRunFrequency])
      .orWhereNull('last_checked')
      .orderBy('priority', 'desc')
      .limit(25);
  }
}
