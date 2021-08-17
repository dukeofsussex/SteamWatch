import { MessageEmbedOptions } from 'slash-create';
import MessageQueue from '../MessageQueue';
import {
  App,
  AppWatcher,
  AppWatcherMention,
  ChannelWebhook,
} from '../../db/knex';
import { SteamUtil } from '../../steam/SteamUtil';
import { EMBED_COLOURS } from '../../utils/constants';
import Worker from '../../workers/Worker';

type WebhookedMentions = Pick<ChannelWebhook, 'webhookId' | 'webhookToken'>
& { mentions: string[] };

type WebhookWatcher = Pick<AppWatcher, 'id'>
& Pick<AppWatcherMention, 'entityId' | 'type'>
& Pick<ChannelWebhook, 'webhookId' | 'webhookToken'>;

export default abstract class Watcher extends Worker {
  private readonly queue: MessageQueue;

  constructor(queue: MessageQueue, breakMs: number) {
    super(breakMs);
    this.queue = queue;
  }

  protected async enqueue(watchers: WebhookWatcher[], embed: MessageEmbedOptions) {
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
          .push(`<@${watcher.type === 'role' ? '&' : ''}${watcher.entityId}>`);
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
        icon_url: SteamUtil.getIconUrl(app.id, app.icon),
        text: app.name,
      },
      url,
      timestamp,
      thumbnail: {
        url: SteamUtil.getIconUrl(app.id, app.icon),
      },
    };
  }
}
