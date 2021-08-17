import { oneLine, stripIndents } from 'common-tags';
import { Knex } from 'knex';
import { MessageEmbedOptions } from 'slash-create';
import Watcher from './Watcher';
import MessageQueue from '../MessageQueue';
import transformArticle from '../transformers';
import db from '../../db';
import { App } from '../../db/knex';
import SteamAPI from '../../steam/SteamAPI';
import { SteamUtil } from '../../steam/SteamUtil';
import env from '../../utils/env';
import logger from '../../utils/logger';

type QueryResult = Omit<App, 'type' | 'lastCheckedNews'>;

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
        message: stripIndents`
          Unable to fetch app news for ${newsItem.id}!
          ${err}
        `,
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
      embed.image = { url: SteamUtil.getNewsImage(transformed.thumbnail) };
    }

    await this.preEnqueue(newsItem.id, embed);

    return this.wait();
  }

  private async preEnqueue(appId: number, embed: MessageEmbedOptions) {
    const watchers = await db.select(
      'app_watcher.id',
      'entity_id',
      'type',
      'webhook_id',
      'webhook_token',
    ).from('app_watcher')
      .leftJoin('app_watcher_mention', 'app_watcher_mention.watcher_id', 'app_watcher.id')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'app_watcher.channel_id')
      .innerJoin('guild', 'guild.id', 'channel_webhook.guild_id')
      .where({
        appId,
        watchNews: true,
      });

    await this.enqueue(watchers, embed);
  }

  private static async fetchNextApp() {
    const watcherAverage = await db.avg('count AS average')
      .from((builder: Knex.QueryBuilder) => builder.count('app_id AS count')
        .from('app_watcher')
        .where('app_watcher.watch_news', true)
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
      .innerJoin(db.select('app_id', db.raw('COUNT(app_id) AS watcher_count')).from('app_watcher')
        .where('app_watcher.watch_news', true)
        .groupBy('app_id')
        .as('watchers'), 'app.id', 'watchers.app_id')
      .whereRaw('last_checked_news <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)', [env.settings.watcherRunFrequency])
      .orWhereNull('last_checked_news')
      .orderBy('priority', 'desc')
      .first();
  }
}
