import { TextChannel, RichEmbed } from 'discord.js';
import { oneLine } from 'common-tags';
import db from '../../db';
import logger from '../../logger';
import WebApi, { SteamNewsItem } from '../../steam/WebApi';
import SteamWatchClient from '../../structures/SteamWatchClient';
import { EMBED_COLOURS } from '../../utils/constants';
import { insertEmoji } from '../../utils/templateTags';

import Knex = require('knex');

const NEWS_RATE_LIMIT = 2000; // 2s
const NEWS_FREQUEUNCY = 6; // 6h
const RETRY_DELAY = 900000; // 15m

interface NewsItem {
  id: number;
  name: string;
  articleId: string;
}

export default class NewsProcessor {
  private client: SteamWatchClient;

  private timeout?: NodeJS.Timeout;

  constructor(client: SteamWatchClient) {
    this.client = client;
  }

  start() {
    this.preProcess();
  }

  stop() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
  }

  private async preProcess() {
    const average = await db.avg('count AS average')
      .from(function innerCount(this: Knex) {
        this.count('app_id AS count')
          .from('app_watcher')
          .where('app_watcher.watch_news', true)
          .groupBy('app_id')
          .as('innerCount');
      })
      .first()
      .then((res: any) => res.average || 0);

    const newsItem = await db.select<NewsItem[]>(
      'app.id',
      'app.name',
      'article_id',
      db.raw(
        oneLine`
          watcher_count
          + (TIMESTAMPDIFF(HOUR, IFNULL(last_checked_news, NOW() - INTERVAL 1 YEAR), NOW()) DIV ?) * ?
          AS priority
        `,
        [NEWS_FREQUEUNCY, average],
      ),
    ).from('app')
      .innerJoin(db.select('app_id', db.raw('COUNT(app_id) AS watcher_count')).from('app_watcher')
        .where('app_watcher.watch_news', true)
        .groupBy('app_id')
        .as('watchers'), 'app.id', 'watchers.app_id')
      .leftJoin(
        db.select(
          'app_id',
          { articleId: 'id' },
          db.raw('MAX(created_at) AS mca'),
        ).from('app_news')
          .groupBy('id')
          .as('news'), 'app.id', 'news.app_id',
      )
      .whereRaw('last_checked_news <= DATE_SUB(NOW(), INTERVAL ? HOUR)', [NEWS_FREQUEUNCY])
      .orWhereNull('last_checked_news')
      .orderBy('priority', 'desc')
      .first();

    if (!newsItem) {
      this.timeout = setTimeout(() => this.preProcess(), RETRY_DELAY);
      return;
    }

    this.process(newsItem);
  }

  // eslint-disable-next-line class-methods-use-this
  private async process(newsItem: NewsItem) {
    let news = null;

    try {
      news = await WebApi.getAppNewsAsync(newsItem.id);
    } catch (err) {
      logger.error({
        group: 'Processor',
        message: err,
      });
    }

    await db('app').update({ lastCheckedNews: new Date() })
      .where('id', newsItem.id);

    if (news && news.gid !== newsItem.articleId) {
      await db.insert({
        id: news.gid,
        appId: news.appid,
        url: news.url,
        createdAt: new Date(news.date * 1000),
      }).into('app_news');

      await this.postProcess(newsItem.name, news);
    }

    this.timeout = setTimeout(() => this.preProcess(), NEWS_RATE_LIMIT);
  }

  private async postProcess(name: string, news: SteamNewsItem) {
    const watchers = await db.select('app_watcher.id', 'channel_id', 'entity_id', 'type')
      .from('app_watcher')
      .leftJoin('app_watcher_mention', 'app_watcher_mention.watcher_id', 'app_watcher.id')
      .where({
        appId: news.appid,
        watchNews: true,
      });

    const embed = new RichEmbed({
      color: EMBED_COLOURS.DEFAULT,
      title: `**${name}**`,
      description: insertEmoji`:NEWS: [${news.title}](${news.url})`,
      url: `https://store.steampowered.com/app/${news.appid}`,
      timestamp: new Date(news.date * 1000),
    });

    let currentWatcherId = watchers[0].id || -1;
    let currentWatcherMentions = [];

    // TODO Move to a dedicated notification service once the guild count rises
    for (let i = 0; i <= watchers.length; i += 1) {
      const watcher = watchers[i];
      if (!watcher || currentWatcherId !== watcher.id) {
        const channel = this.client.channels
          .get(watcher
            ? watcher.channelId
            : watchers[watchers.length - 1].channelId) as TextChannel;
        channel!.send(currentWatcherMentions.join(' ') || '', { embed });

        currentWatcherId = watcher ? watcher.id : -1;
        currentWatcherMentions = [];
      }

      if (watcher && watcher.entityId) {
        currentWatcherMentions.push(`<@${watcher.type === 'role' ? '&' : ''}${watcher.entityId}>`);
      }
    }
  }
}
