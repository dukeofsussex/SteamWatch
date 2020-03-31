import { RichEmbed, RichEmbedOptions } from 'discord.js';
import MessageQueue from '../MessageQueue';
import db from '../../db';
import WebApi from '../../steam/WebApi';
import { EMBED_COLOURS } from '../../utils/constants';

const RETRY_DELAY = 900000; // 15m

interface App {
  icon: string;
  id: number;
  name: string;
}

export default abstract class Watcher {
  private readonly queue: MessageQueue;

  private readonly rateLimit: number;

  private timeout?: NodeJS.Timeout;

  constructor(queue: MessageQueue, rateLimit: number) {
    this.queue = queue;
    this.rateLimit = rateLimit;
  }

  start() {
    this.watchAsync();
  }

  stop() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
  }

  protected async enqueueAsync(appId: number, embed: RichEmbed, watcherType: 'watchPrice' | 'watchNews') {
    const watchers = await db.select(
      'app_watcher.id',
      'entity_id',
      'type',
      'webhook_id',
      'webhook_token',
    ).from('app_watcher')
      .leftJoin('app_watcher_mention', 'app_watcher_mention.watcher_id', 'app_watcher.id')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'app_watcher.channel_id')
      .where({
        appId,
        [watcherType]: true,
      });

    const groupedWatchers = watchers.reduce((group, watcher) => {
      // eslint-disable-next-line no-param-reassign
      group[watcher.id] = group[watcher.id] || {
        webhookId: watcher.webhookId,
        webhookToken: watcher.webhookToken,
        mentions: [],
      };

      if (watcher.entityId) {
        group[watcher.id].mentions
          .push(`<@${watcher.type === 'role' ? '&' : ''}${watcher.entityId}>`);
      }

      return group;
    }, {});

    const keys = Object.keys(groupedWatchers);

    for (let i = 0; i < keys.length; i += 1) {
      const watcher = groupedWatchers[keys[i]];
      this.queue.push(watcher.webhookId, watcher.webhookToken, {
        content: watcher.mentions.join(' ') || '',
        embeds: [embed],
      });
    }
  }

  protected next() {
    this.timeout = setTimeout(() => this.watchAsync(), this.rateLimit);
  }

  protected retry() {
    this.timeout = setTimeout(() => this.watchAsync(), RETRY_DELAY);
  }

  protected abstract watchAsync(): Promise<void>;

  protected static getEmbed(
    app: App,
    {
      title, description, url, timestamp,
    }: RichEmbedOptions,
  ) {
    return new RichEmbed({
      color: EMBED_COLOURS.DEFAULT,
      title: `**${title}**`,
      description,
      footer: {
        text: app.name,
      },
      url,
      timestamp,
      thumbnail: {
        url: WebApi.getIconUrl(app.id, app.icon),
      },
    });
  }
}
