import { oneLine } from 'common-tags';
import { subHours } from 'date-fns';
import type { Knex } from 'knex';
import {
  App,
  AppWorkshop,
  db,
  EmbedBuilder,
  env,
  EPublishedFileQueryType,
  logger,
  MAX_EMBEDS,
  PublishedFile,
  steamClient,
  transformArticle,
  Watcher as DBWatcher,
  WatcherType,
} from '@steamwatch/shared';
import Watcher from './Watcher';
import type MessageQueue from '../MessageQueue';

const MAX_FILES = MAX_EMBEDS * MAX_EMBEDS;

type QueryResult = Pick<App, 'icon' | 'name'>
& AppWorkshop
& Pick<DBWatcher, 'type'>;

export default class WorkshopWatcher extends Watcher {
  constructor(queue: MessageQueue) {
    super(queue, 10000); // 10s
  }

  protected async work() {
    if (!steamClient.connected) {
      logger.info('Waiting for Steam connection');
      return this.wait();
    }

    const workshop = await WorkshopWatcher.fetchNextWorkshop();

    if (!workshop) {
      return this.pause();
    }

    logger.info({
      message: 'Checking workshop for submissions',
      app: workshop,
    });

    let cursor;
    let files: PublishedFile[] = [];
    const lastSubmissionMs = (
      (workshop.type === WatcherType.WorkshopNew ? workshop.lastNew : workshop.lastUpdate)
        ?? subHours(new Date(), 1)
    ).getTime() / 1000;
    let index = -1;

    while (files.length < MAX_FILES && index === -1) {
      let response;

      try {
        // eslint-disable-next-line no-await-in-loop
        response = await steamClient.queryFiles(
          workshop.appId,
          workshop.type === WatcherType.WorkshopNew
            ? EPublishedFileQueryType.RankedByPublicationDate
            : EPublishedFileQueryType.RankedByLastUpdatedDate,
          workshop.filetype,
          cursor,
        );
      } catch (err) {
        logger.error({
          message: 'Unable to fetch workshop submissions',
          appId: workshop.id,
          err,
        });
        break;
      }

      cursor = response.next_cursor;

      if (cursor === '*' || response.total === 0) {
        break;
      }

      index = response.publishedfiledetails.findIndex((file) => file[workshop.type === WatcherType.WorkshopNew ? 'time_created' : 'time_updated'] <= lastSubmissionMs);
      files = files.concat(
        response.publishedfiledetails.slice(0, index !== -1 ? index : undefined),
      );
    }

    await db('app_workshop').update({
      lastCheckedNew: workshop.type === WatcherType.WorkshopNew
        ? new Date()
        : workshop.lastCheckedNew,
      lastNew: workshop.type === WatcherType.WorkshopNew && files.length
        ? new Date(files[0]!.time_created * 1000)
        : workshop.lastNew,
      lastCheckedUpdate: workshop.type === WatcherType.WorkshopUpdate
        ? new Date()
        : workshop.lastCheckedUpdate,
      lastUpdate: workshop.type === WatcherType.WorkshopUpdate && files.length
        ? new Date(files[0]!.time_updated * 1000)
        : workshop.lastUpdate,
    })
      .where('id', workshop.id);

    for (let i = files.length - 1; i >= 0; i -= 1) {
      const file = files[i] as PublishedFile;

      if (file.banned || file.ban_reason) {
        // eslint-disable-next-line no-continue
        continue;
      }

      logger.info({
        message: 'Found workshop submission',
        file,
      });

      let description = transformArticle(file.file_description).markdown;

      if (workshop.type === WatcherType.WorkshopUpdate) {
        // eslint-disable-next-line no-await-in-loop
        const [entry] = (await steamClient.getChangeHistory(file.publishedfileid, 1)).changes;
        description = entry ? transformArticle(entry.change_description).markdown : '';
        description = description || 'No changelog';
      }

      this.enqueue([{
        // eslint-disable-next-line no-await-in-loop
        ...(await EmbedBuilder.createWorkshop(
          {
            icon: workshop.icon,
            id: workshop.appId,
            name: workshop.name,
          },
          file,
          workshop.type === WatcherType.WorkshopNew
            ? 'time_created'
            : 'time_updated',
        )),
        ...(description ? { description } : {}),
      }], {
        workshopId: workshop.id,
        'watcher.type': workshop.type,
      });
    }

    return this.wait();
  }

  private static async fetchNextWorkshop() {
    const watcherAverage = await db.avg('count AS average')
      .from((builder: Knex.QueryBuilder) => builder.count('workshop_id AS count')
        .from('watcher')
        .innerJoin('app_workshop', 'app_workshop.id', 'watcher.workshop_id')
        .whereIn('type', [WatcherType.WorkshopNew, WatcherType.WorkshopUpdate])
        .andWhere('inactive', false)
        .groupBy('watcher.type', 'app_workshop.app_id', 'app_workshop.filetype')
        .as('innerCount'))
      .first()
      .then((res: any) => res.average || 0);

    return db.select<QueryResult>(
      'app.name',
      'app.icon',
      'app_workshop.*',
      'watcher.type',
      db.raw(
        oneLine`
          watcher_count
          + (TIMESTAMPDIFF
            (HOUR,
              IFNULL(
                IF(watcher.type = ?,
                  last_checked_new,
                  last_checked_update),
                UTC_TIMESTAMP() - INTERVAL 1 YEAR
              ),
            UTC_TIMESTAMP())
          DIV ?) * ?
          AS priority
        `,
        [WatcherType.WorkshopNew, env.settings.watcherRunFrequency, watcherAverage],
      ),
    ).from('app_workshop')
      .innerJoin('app', 'app.id', 'app_workshop.app_id')
      .innerJoin('watcher', 'watcher.workshop_id', 'app_workshop.id')
      .innerJoin(db.select('app_workshop.app_id', db.raw('COUNT(workshop_id) AS watcher_count'))
        .from('watcher')
        .innerJoin('app_workshop', 'app_workshop.id', 'watcher.workshop_id')
        .whereIn('type', [WatcherType.WorkshopNew, WatcherType.WorkshopUpdate])
        .andWhere('inactive', false)
        .groupBy('watcher.type', 'app_workshop.app_id', 'app_workshop.filetype')
        .as('watchers'), 'app.id', 'watchers.app_id')
      .whereRaw('IF(watcher.type = ?, last_checked_new, last_checked_update) <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)', [WatcherType.WorkshopNew, env.settings.watcherRunFrequency])
      .orWhereRaw('IF(watcher.type = ?, last_checked_new, last_checked_update) IS NULL', [WatcherType.WorkshopNew])
      .groupBy('watcher.type', 'app_workshop.app_id', 'app_workshop.filetype')
      .orderBy('priority', 'desc')
      .first() as Promise<QueryResult | undefined>;
  }
}
