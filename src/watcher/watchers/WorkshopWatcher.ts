import { oneLine } from 'common-tags';
import { Knex } from 'knex';
import Watcher from './Watcher';
import MessageQueue from '../MessageQueue';
import db from '../../db';
import { App } from '../../db/knex';
import SteamAPI from '../../steam/SteamAPI';
import SteamUtil from '../../steam/SteamUtil';
import { WatcherType } from '../../types';
import env from '../../utils/env';
import logger from '../../utils/logger';

export default class WorkshopWatcher extends Watcher {
  constructor(queue: MessageQueue) {
    super(queue, 10000); // 10s
  }

  protected async work() {
    const app = await WorkshopWatcher.fetchNextApp();

    if (!app) {
      return this.pause();
    }

    let ugc;

    try {
      ugc = await SteamAPI.queryFiles(app.id);
    } catch (err) {
      logger.error({
        group: 'Watcher',
        message: `Unable to fetch workshop submissions for ${app.id}!`,
        err,
      });
    }

    if (!ugc) {
      return this.wait();
    }

    await db('app').update({
      lastCheckedUgc: new Date(),
      latestUgc: ugc.publishedfileid,
    })
      .where('id', app.id);

    if (app.latestUgc === ugc.publishedfileid || ugc.banned) {
      return this.pause();
    }

    const author = await SteamAPI.getPlayerSummary(ugc.creator);

    const embed = Watcher.getEmbed({
      icon: app.icon,
      id: app.id,
      name: app.name,
    }, {
      description: ugc.description,
      timestamp: new Date(ugc.time_updated * 1000),
      title: ugc.title,
      url: SteamUtil.URLS.UGC(ugc.publishedfileid),
    });

    if (author) {
      embed.author = {
        name: author.personaname,
        icon_url: author.avatar,
        url: SteamUtil.URLS.Profile(author.steamid),
      };
    }

    if (ugc.preview_url) {
      embed.image = {
        url: ugc.preview_url,
      };
    }

    embed.fields = [{
      name: 'Steam Client Link',
      value: SteamUtil.BP.UGC(ugc.publishedfileid),
    }];

    await this.enqueue(embed, {
      appId: app.id,
      'watcher.type': WatcherType.WORKSHOP,
    });

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
