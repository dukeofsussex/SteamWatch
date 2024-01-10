import { oneLine } from 'common-tags';
import { subHours } from 'date-fns';
import type { Knex } from 'knex';
import {
  App,
  db,
  EmbedBuilder,
  env,
  EPublishedFileQueryType,
  logger,
  MAX_EMBEDS,
  PublishedFile,
  steamClient,
  transformArticle,
  WatcherType,
  Workshop,
  WorkshopType,
} from '@steamwatch/shared';
import Watcher from './Watcher';
import type MessageQueue from '../MessageQueue';

const MAX_FILES = MAX_EMBEDS * MAX_EMBEDS;
const PER_PAGE = 25;

type QueryResult = Pick<App, 'icon' | 'name'>
& Workshop
& { 'watcherType': WatcherType };

export default class WorkshopWatcher extends Watcher {
  private type: WorkshopType;

  constructor(queue: MessageQueue, type: WorkshopType) {
    super(queue, 10000); // 10s
    this.type = type;
  }

  protected async work() {
    if (!steamClient.connected) {
      logger.info('Waiting for Steam connection');
      return this.wait();
    }

    const workshop = await this.fetchNextWorkshop();

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
      (workshop.watcherType === WatcherType.WorkshopNew ? workshop.lastNew : workshop.lastUpdate)
        ?? subHours(new Date(), 1)
    ).getTime() / 1000;
    let index = -1;
    let page = 1;

    while (files.length < MAX_FILES && index === -1) {
      let response;

      try {
        if (this.type === WorkshopType.App) {
          // eslint-disable-next-line no-await-in-loop
          response = await steamClient.queryFiles(
            workshop.appId,
            workshop.watcherType === WatcherType.WorkshopNew
              ? EPublishedFileQueryType.RankedByPublicationDate
              : EPublishedFileQueryType.RankedByLastUpdatedDate,
            workshop.filetype,
            PER_PAGE,
            cursor,
          );
        } else {
          // eslint-disable-next-line no-await-in-loop
          response = await steamClient.getUserFiles(
            workshop.appId,
            workshop.steamId!,
            workshop.filetype,
            page,
            PER_PAGE,
          );
        }
      } catch (err) {
        logger.error({
          message: 'Unable to fetch workshop submissions',
          appId: workshop.appId,
          steamId: workshop.steamId,
          err,
        });
        break;
      }

      if (response.total === 0 || !response.publishedfiledetails) {
        break;
      }

      if ('next_cursor' in response) {
        if (response.next_cursor === '*' || response.next_cursor === cursor) {
          break;
        }

        cursor = response.next_cursor;
      }

      index = response.publishedfiledetails.findIndex((file) => file[workshop.watcherType === WatcherType.WorkshopNew ? 'time_created' : 'time_updated'] <= lastSubmissionMs);
      files = files.concat(
        response.publishedfiledetails.slice(0, index !== -1 ? index : undefined),
      );
      page += 1;

      if (response.publishedfiledetails.length < PER_PAGE) {
        break;
      }
    }

    await db('workshop').update({
      lastCheckedNew: workshop.watcherType === WatcherType.WorkshopNew
        ? new Date()
        : workshop.lastCheckedNew,
      lastNew: workshop.watcherType === WatcherType.WorkshopNew && files.length
        ? new Date(files[0]!.time_created * 1000)
        : workshop.lastNew,
      lastCheckedUpdate: workshop.watcherType === WatcherType.WorkshopUpdate
        ? new Date()
        : workshop.lastCheckedUpdate,
      lastUpdate: workshop.watcherType === WatcherType.WorkshopUpdate && files.length
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

      if (workshop.watcherType === WatcherType.WorkshopUpdate) {
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
          workshop.watcherType === WatcherType.WorkshopNew
            ? 'time_created'
            : 'time_updated',
        )),
        ...(description ? { description } : {}),
      }], {
        workshopId: workshop.id,
        'watcher.type': workshop.watcherType,
        'workshop.type': this.type,
      });
    }

    return this.wait();
  }

  private async fetchNextWorkshop() {
    const watcherAverage = await db.avg('count AS average')
      .from((builder: Knex.QueryBuilder) => builder.count('workshop_id AS count')
        .from('watcher')
        .innerJoin('workshop', 'workshop.id', 'watcher.workshop_id')
        .whereIn('watcher.type', [WatcherType.WorkshopNew, WatcherType.WorkshopUpdate])
        .andWhere('inactive', false)
        .groupBy('watcher.type', 'workshop.app_id', 'workshop.filetype')
        .as('innerCount'))
      .first()
      .then((res: any) => res.average || 0);

    return db.select<QueryResult>(
      'app.name',
      'app.icon',
      'workshop.*',
      { watcherType: 'watcher.type' },
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
    ).from('workshop')
      .innerJoin('app', 'app.id', 'workshop.app_id')
      .innerJoin('watcher', 'watcher.workshop_id', 'workshop.id')
      .innerJoin(db.select('workshop.app_id', db.raw('COUNT(workshop_id) AS watcher_count'))
        .from('watcher')
        .innerJoin('workshop', 'workshop.id', 'watcher.workshop_id')
        .whereIn('watcher.type', [WatcherType.WorkshopNew, WatcherType.WorkshopUpdate])
        .andWhere('inactive', false)
        .groupBy('watcher.type', 'workshop.app_id', 'workshop.filetype')
        .as('watchers'), 'app.id', 'watchers.app_id')
      .where((builder) => builder.whereRaw('IF(watcher.type = ?, last_checked_new, last_checked_update) <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)', [WatcherType.WorkshopNew, env.settings.watcherRunFrequency])
        .orWhereRaw('IF(watcher.type = ?, last_checked_new, last_checked_update) IS NULL', [WatcherType.WorkshopNew]))
      .andWhere('workshop.type', this.type)
      .groupBy('watcher.type', 'workshop.app_id', 'workshop.filetype')
      .orderBy('priority', 'desc')
      .first() as Promise<QueryResult | undefined>;
  }
}
