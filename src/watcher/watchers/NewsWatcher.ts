import { oneLine } from 'common-tags';
import { Knex } from 'knex';
import Watcher from './Watcher';
import MessageQueue from '../MessageQueue';
import transformArticle from '../transformers';
import db from '../../db';
import { App } from '../../db/knex';
import SteamAPI from '../../steam/SteamAPI';
import SteamUtil from '../../steam/SteamUtil';
import { WatcherType } from '../../types';
import env from '../../utils/env';
import logger from '../../utils/logger';

type QueryResult = Pick<App, 'icon' | 'id' | 'name'>;

export default class NewsWatcher extends Watcher {
  constructor(queue: MessageQueue) {
    super(queue, 10000); // 10s
  }

  protected async work() {
    const newsItem = await NewsWatcher.fetchNextApp();

    if (!newsItem) {
      return this.pause();
    }

    let news;

    try {
      news = await SteamAPI.getAppNews(newsItem.id);
    } catch (err) {
      logger.error({
        group: 'Watcher',
        message: `Unable to fetch app news for ${newsItem.id}!`,
        err,
      });
    }

    await db('app').update('lastCheckedNews', new Date())
      .where('id', newsItem.id);

    if (!news) {
      return this.wait();
    }

    const article = await db.select('id')
      .from('app_news')
      .where({
        gid: news.gid,
        appId: newsItem.id,
      })
      .first();

    if (article) {
      return this.wait();
    }

    const transformed = transformArticle(
      news.contents,
      env.settings.maxArticleLength,
      env.settings.maxArticleNewlines,
    );

    // Truncate long news titles
    news.title = news.title.length > 128 ? `${news.title.substring(0, 125)}...` : news.title;

    await db.insert({
      gid: news.gid,
      appId: newsItem.id,
      title: news.title,
      markdown: transformed.markdown,
      thumbnail: transformed.thumbnail,
      url: news.url,
      createdAt: new Date(news.date * 1000),
    }).into('app_news')
      .onConflict('appId')
      .merge(['createdAt', 'gid', 'markdown', 'thumbnail', 'title', 'url']);

    const embed = Watcher.getEmbed(newsItem, {
      title: news.title,
      description: transformed.markdown,
      url: news.url,
      timestamp: new Date(news.date * 1000),
    });

    if (transformed.thumbnail) {
      embed.image = { url: SteamUtil.URLS.NewsImage(transformed.thumbnail) };
    }

    await this.enqueue(embed, {
      appId: newsItem.id,
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

    return db.select<QueryResult[]>(
      'app.id',
      'app.name',
      'app.icon',
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
