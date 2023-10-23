import type { DiscordAPIError } from '@discordjs/rest';
import { RESTJSONErrorCodes, RESTPostAPIWebhookWithTokenResult, Routes } from 'discord-api-types/v10';
import { join } from 'node:path';
import type { Response } from 'node-fetch';
import type { EditMessageOptions } from 'slash-create';
import {
  db,
  DiscordAPI,
  DiscordUser,
  logger,
} from '@steamwatch/shared';
import Queue from './Queue';

const PURGE_ERROR_CODES = [
  RESTJSONErrorCodes.UnknownChannel,
  RESTJSONErrorCodes.UnknownGuild,
  RESTJSONErrorCodes.UnknownWebhook,
  RESTJSONErrorCodes.WebhooksPostedToForumChannelsCannotHaveBothAThreadNameAndThreadId,
  RESTJSONErrorCodes.WebhooksPostedToForumChannelsMustHaveAThreadNameOrThreadId,
];
const SLOWMODE_DELAY = 300000; // 5m

export interface QueuedMessage {
  id: string;
  token: string;
  threadId: string | null;
  message: Pick<EditMessageOptions, 'content' | 'embeds' | 'components'>;
  customWebhookAvatar?: string;
  customWebhookName?: string;
}

export default class MessageQueue extends Queue<QueuedMessage[]> {
  protected filePath;

  protected offset: number;

  protected queue: QueuedMessage[];

  private user?: DiscordUser;

  constructor() {
    super();
    this.filePath = join(__dirname, '..', 'data', 'message.queue.json');
    this.offset = 0;
    this.queue = [];
  }

  enqueue(item: QueuedMessage) {
    this.queue.push(item);
    this.run();
  }

  override async start() {
    this.user = await DiscordAPI.getCurrentUser();
    super.start();
  }

  protected async work() {
    const {
      customWebhookAvatar,
      customWebhookName,
      id,
      message,
      threadId,
      token,
    } = this.dequeue()!;

    try {
      await DiscordAPI.post(Routes.webhook(id, token), {
        ...(threadId ? {
          query: new URLSearchParams({
            thread_id: threadId,
          }),
        } : {}),
        body: {
          content: message.content,
          username: customWebhookName || this.user!.username,
          avatar_url: customWebhookAvatar || this.user!.avatarUrl,
          embeds: message.embeds || [],
          components: message.components || [],
        },
      }) as RESTPostAPIWebhookWithTokenResult;
    } catch (err) {
      const errCode = (err as DiscordAPIError).code;

      if (PURGE_ERROR_CODES.includes(parseInt(errCode as string, 10))) {
        await MessageQueue.purgeWebhook(id);
      } else {
        logger.error({
          message: 'Unable to send webhook request',
          id,
          token,
          body: message,
          code: errCode,
          err,
        });

        this.queue.push({
          id,
          message,
          threadId,
          token,
        });

        const res = err as Response;

        if (res.status >= 500) {
          logger.warn({
            message: 'Discord is having issues, slowing down...',
            res,
          });

          this.timeout = setTimeout(() => this.work(), SLOWMODE_DELAY);
          return;
        }
      }
    }

    if (this.size()) {
      this.timeout = setTimeout(() => this.work(), this.queueDelay);
    } else if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
  }

  protected dequeue() {
    if (this.size() === 0) {
      return null;
    }

    const item = this.queue[this.offset]!;
    this.offset += 1;

    if (this.offset * 2 >= this.queue.length) {
      this.queue = this.queue.slice(this.offset);
      this.offset = 0;
    }

    return item;
  }

  protected size() {
    return this.queue.length - this.offset;
  }

  private static async purgeWebhook(id: string) {
    logger.info({
      message: 'Purging expired webhook',
      id,
    });
    return db.delete()
      .from('channel_webhook')
      .where('webhookId', id);
  }
}
