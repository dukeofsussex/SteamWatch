import { oneLine } from 'common-tags';
import Watcher from './Watcher';
import MessageQueue from '../MessageQueue';
import transformArticle from '../transformers';
import db from '../../db';
import env from '../../env';
import logger from '../../logger';
import WebApi from '../../steam/WebApi';

import Knex = require('knex');

const NEWS_FREQUEUNCY = 6; // 6h
const NEWS_RATE_LIMIT = 2000; // 2s

interface AppNewsItem {
  articleId: string;
  icon: string;
  id: number;
  name: string;
}

export default class NewsWatcher extends Watcher {
  constructor(queue: MessageQueue) {
    super(queue, NEWS_RATE_LIMIT);
  }

  protected async watchAsync() {
    const newsItem = await NewsWatcher.fetchNextAppAsync();

    if (!newsItem) {
      this.retry();
      return;
    }

    let news = null;

    try {
      news = await WebApi.getAppNewsAsync(newsItem.id);
    } catch (err) {
      logger.error({
        group: 'Watcher',
        message: err,
      });
    }

    await db('app').update({ lastCheckedNews: new Date() })
      .where('id', newsItem.id);

    if (!news || news.gid === newsItem.articleId) {
      this.next();
      return;
    }

    const transformed = transformArticle(
      news.contents,
      env.settings.maxArticleLength,
      env.settings.maxArticleNewlines,
    );

    await db.insert({
      id: news.gid,
      appId: newsItem.id,
      title: news.title,
      markdown: transformed.markdown,
      thumbnail: transformed.thumbnail,
      url: news.url,
      createdAt: new Date(news.date * 1000),
    }).into('app_news');

    const embed = Watcher.getEmbed(newsItem, {
      title: news.title,
      description: transformed.markdown,
      url: news.url,
      timestamp: new Date(news.date * 1000),
    });

    if (transformed.thumbnail) {
      embed.image = { url: WebApi.getNewsImage(transformed.thumbnail) };
    }

    await this.enqueueAsync(newsItem.id, embed, 'watchNews');

    this.next();
  }

  private static async fetchNextAppAsync() {
    const watcherAverage = await db.avg('count AS average')
      .from(function innerCount(this: Knex) {
        this.count('app_id AS count')
          .from('app_watcher')
          .where('app_watcher.watch_news', true)
          .groupBy('app_id')
          .as('innerCount');
      })
      .first()
      .then((res: any) => res.average || 0);

    return db.select<AppNewsItem[]>(
      'app.id',
      'app.name',
      'app.icon',
      'article_id',
      db.raw(
        oneLine`
        watcher_count
        + (TIMESTAMPDIFF(HOUR, IFNULL(last_checked_news, NOW() - INTERVAL 1 YEAR), NOW()) DIV ?) * ?
        AS priority
      `,
        [NEWS_FREQUEUNCY, watcherAverage],
      ),
    ).from('app')
      .innerJoin(db.select('app_id', db.raw('COUNT(app_id) AS watcher_count')).from('app_watcher')
        .where('app_watcher.watch_news', true)
        .groupBy('app_id')
        .as('watchers'), 'app.id', 'watchers.app_id')
      .leftJoin(
        db.select(
          'app_news.app_id',
          { articleId: 'app_news.id' },
        ).from('app_news')
          .leftJoin({ appNewsLeft: 'app_news' }, function newsTimestampLeftJoin() {
            this.on('app_news_left.app_id', '=', 'app_news.app_id').andOn('app_news_left.created_at', '>', 'app_news.created_at');
          })
          .whereNull('app_news_left.id')
          .as('news'), 'app.id', 'news.app_id',
      )
      .whereRaw('last_checked_news <= DATE_SUB(NOW(), INTERVAL ? HOUR)', [NEWS_FREQUEUNCY])
      .orWhereNull('last_checked_news')
      .orderBy('priority', 'desc')
      .first();
  }
}
