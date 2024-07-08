import type { Knex } from 'knex';
import type { MessageEmbedOptions } from 'slash-create';
import {
  db,
  ChannelWebhook,
  Watcher as DBWatcher,
  WatcherMention,
  Guild,
} from '@steamwatch/shared';
import type MessageQueue from '../MessageQueue';
import Worker from '../workers/Worker';

type WebhookedMentions = Pick<ChannelWebhook, 'webhookId' | 'webhookToken'>
& Pick<DBWatcher, 'threadId'>
& Pick<Guild, 'customWebhookAvatar' | 'customWebhookName'>
& { mentions: string[] };

type WebhookWatcher = Pick<WatcherMention, 'entityId' | 'type'>
& Pick<ChannelWebhook, 'webhookId' | 'webhookToken' | 'guildId'>
& Pick<DBWatcher, 'id' | 'threadId'>
& Pick<Guild, 'customWebhookAvatar' | 'customWebhookName'>
& { maxPledgeTier: number | null };

export default abstract class Watcher extends Worker {
  private readonly queue: MessageQueue;

  constructor(queue: MessageQueue, breakMs: number) {
    super(breakMs);
    this.queue = queue;
  }

  protected async enqueue(
    embeds: MessageEmbedOptions[],
    where: object | ((b: Knex.QueryBuilder) => Knex.QueryBuilder),
  ) {
    const watchers: WebhookWatcher[] = await db.select(
      'watcher.id',
      'thread_id',
      'entity_id',
      'channel_webhook.guild_id',
      'watcher_mention.type',
      'webhook_id',
      'webhook_token',
      'custom_webhook_name',
      'custom_webhook_avatar',
      db.raw('MAX(pledge_tier) AS maxPledgeTier'),
    ).from('watcher')
      .leftJoin('watcher_mention', 'watcher_mention.watcher_id', 'watcher.id')
      .leftJoin('workshop', 'workshop.id', 'watcher.workshop_id')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
      .innerJoin('guild', 'guild.id', 'channel_webhook.guild_id')
      .leftJoin('patron', 'patron.guild_id', 'guild.id')
      .where(where)
      .andWhere('inactive', false)
      .groupBy('guild.id');

    const groupedWatchers = watchers.reduce((
      group: { [index: string]: WebhookedMentions },
      watcher,
    ) => {
      // eslint-disable-next-line no-param-reassign
      group[watcher.id] = group[watcher.id] || {
        customWebhookAvatar: watcher.maxPledgeTier ? watcher.customWebhookAvatar : null,
        customWebhookName: watcher.maxPledgeTier ? watcher.customWebhookName : null,
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
      this.queue.enqueue({
        id: watcher.webhookId,
        token: watcher.webhookToken,
        threadId: watcher.threadId,
        message: {
          content: watcher.mentions.join(' ') || '',
          embeds,
        },
        ...(watcher.customWebhookAvatar ? {
          customWebhookAvatar: watcher.customWebhookAvatar!,
          customWebhookName: watcher.customWebhookName!,
        } : {}),
      });
    }
  }

  protected pause() {
    this.timeout = setTimeout(() => this.work(), 300000); // 5m
  }
}
