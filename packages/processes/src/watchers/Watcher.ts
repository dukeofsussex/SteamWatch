import type { MessageEmbedOptions } from 'slash-create';
import {
  db,
  ChannelWebhook,
  Watcher as DBWatcher,
  WatcherMention,
} from '@steamwatch/shared';
import type MessageQueue from '../MessageQueue';
import Worker from '../workers/Worker';

type WebhookedMentions = Pick<ChannelWebhook, 'webhookId' | 'webhookToken'>
& Pick<DBWatcher, 'threadId'>
& { mentions: string[] };

type WebhookWatcher = Pick<WatcherMention, 'entityId' | 'type'>
& Pick<ChannelWebhook, 'webhookId' | 'webhookToken' | 'guildId'>
& Pick<DBWatcher, 'id' | 'threadId'>;

type KnexWhereObject = object;

export default abstract class Watcher extends Worker {
  private readonly queue: MessageQueue;

  constructor(queue: MessageQueue, breakMs: number) {
    super(breakMs);
    this.queue = queue;
  }

  protected async enqueue(embeds: MessageEmbedOptions[], where: KnexWhereObject) {
    const watchers: WebhookWatcher[] = await db.select(
      'watcher.id',
      'thread_id',
      'entity_id',
      'guild_id',
      'watcher_mention.type',
      'webhook_id',
      'webhook_token',
    ).from('watcher')
      .leftJoin('watcher_mention', 'watcher_mention.watcher_id', 'watcher.id')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
      .innerJoin('guild', 'guild.id', 'channel_webhook.guild_id')
      .where(where);

    const groupedWatchers = watchers.reduce((
      group: { [index: string]: WebhookedMentions },
      watcher,
    ) => {
      // eslint-disable-next-line no-param-reassign
      group[watcher.id] = group[watcher.id] || {
        webhookId: watcher.webhookId,
        webhookToken: watcher.webhookToken,
        threadId: watcher.threadId,
        mentions: [],
      };

      if (watcher.entityId) {
        group[watcher.id]!.mentions
          .push(watcher.entityId === watcher.guildId ? '@everyone' : `<@${watcher.type === 'role' ? '&' : ''}${watcher.entityId}>`);
      }

      return group;
    }, {});

    const keys = Object.keys(groupedWatchers);

    for (let i = 0; i < keys.length; i += 1) {
      const watcher = groupedWatchers[keys[i]!] as WebhookedMentions;
      this.queue.enqueue(
        watcher.webhookId,
        watcher.webhookToken,
        watcher.threadId,
        {
          content: watcher.mentions.join(' ') || '',
          embeds,
        },
      );
    }
  }

  protected pause() {
    this.timeout = setTimeout(() => this.work(), 900000); // 15m
  }
}
