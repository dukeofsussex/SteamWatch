import { MessageEmbedOptions } from 'slash-create';
import MessageQueue from '../MessageQueue';
import db from '../../db';
import { App, ChannelWebhook, WatcherMention } from '../../db/knex';
import SteamUtil from '../../steam/SteamUtil';
import { EMBED_COLOURS } from '../../utils/constants';
import Worker from '../../workers/Worker';

type WebhookedMentions = Pick<ChannelWebhook, 'webhookId' | 'webhookToken'>
& { mentions: string[] };

type WebhookWatcher = Pick<WatcherMention, 'entityId' | 'type'>
& Pick<ChannelWebhook, 'webhookId' | 'webhookToken' | 'guildId'>
& { id: number };

type KnexWhereObject = object;

export default abstract class Watcher extends Worker {
  private readonly queue: MessageQueue;

  constructor(queue: MessageQueue, breakMs: number) {
    super(breakMs);
    this.queue = queue;
  }

  protected async enqueue(embed: MessageEmbedOptions, where: KnexWhereObject) {
    const watchers: WebhookWatcher[] = await db.select(
      'watcher.id',
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
        mentions: [],
      };

      if (watcher.entityId) {
        group[watcher.id].mentions
          .push(watcher.entityId === watcher.guildId ? '@everyone' : `<@${watcher.type === 'role' ? '&' : ''}${watcher.entityId}>`);
      }

      return group;
    }, {});

    const keys = Object.keys(groupedWatchers);

    for (let i = 0; i < keys.length; i += 1) {
      const watcher = groupedWatchers[keys[i]];
      this.queue.enqueue(watcher.webhookId, watcher.webhookToken, {
        content: watcher.mentions.join(' ') || '',
        embeds: [embed],
      });
    }
  }

  protected pause() {
    this.timeout = setTimeout(() => this.work(), 900000); // 15m
  }

  protected static getEmbed(
    app: Pick<App, 'icon' | 'id' | 'name'>,
    {
      description,
      timestamp,
      title,
      url,
    }: Pick<MessageEmbedOptions, 'description' | 'timestamp' | 'title' | 'url'>,
  ): MessageEmbedOptions {
    return {
      color: EMBED_COLOURS.DEFAULT,
      title: `**${title}**`,
      description,
      footer: {
        icon_url: SteamUtil.URLS.Icon(app.id, app.icon),
        text: app.name,
      },
      url,
      timestamp,
      thumbnail: {
        url: SteamUtil.URLS.Icon(app.id, app.icon),
      },
    };
  }
}
