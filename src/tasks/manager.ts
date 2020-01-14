// eslint-disable-next-line no-unused-vars
import { CommandoClient } from 'discord.js-commando';
import db from '../db';
import Queue from './queue';
import processNews from './processors/news';
import env from '../env';

// eslint-disable-next-line no-unused-vars
import Knex = require('knex');

const avgQuery = db.avg('count', { as: 'average' })
  .from(function innerCount(this: Knex) {
    this.count('app_id AS count')
      .from('app_watcher')
      .groupBy('app_id')
      .as('innerCount');
  })
  .first();

class Manager {
  newsQueue: Queue;

  constructor(client: CommandoClient) {
    this.newsQueue = new Queue(env.bot.delay * 1000);
    this.newsQueue.onProcess((item: any) => processNews(client, item));
  }

  reset() {
    this.stop();
    this.newsQueue.clear();
  }

  start() {
    this.populateQueues();
  }

  stop() {
    this.newsQueue.stop();
  }

  private async populateQueues() {
    const average = await avgQuery.then((res: any) => res.average || 0);

    const apps = await db.select('app.id', 'article_id', db.raw('watcher_count + (TIMESTAMPDIFF(HOUR, IFNULL(last_checked, NOW() - INTERVAL 1 YEAR), NOW()) DIV 6) * ? AS priority', [average]))
      .from('app')
      .innerJoin(db.select('app_id', db.raw('COUNT(app_id) AS watcher_count')).from('app_watcher')
        .groupBy('app_id')
        .as('watchers'), 'app.id', 'watchers.app_id')
      .leftJoin(db.select('app_id', { article_id: 'id' }, db.raw('MAX(created_at) AS mca')).from('app_news')
        .groupBy('id')
        .as('news'), 'app.id', 'news.app_id')
      .where('last_checked', '<=', new Date())
      .orWhereNull('last_checked')
      .orderBy('priority', 'desc')
      .limit(Math.floor(3600 / env.bot.delay));

    this.newsQueue.addList(apps);

    if (!this.newsQueue.isRunning) {
      this.newsQueue.start();
    }

    setTimeout(() => this.populateQueues(), 3600000);
  }
}

export default Manager;
