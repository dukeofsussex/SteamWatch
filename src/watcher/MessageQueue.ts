import { Constants, MessageEmbed } from 'discord.js';
import fetch from 'node-fetch';
import db from '../db';
import logger from '../logger';
import { existsAsync, readFileAsync, writeFileAsync } from '../utils/fsAsync';

const BACKUP_INTERVAL = 60000; // 1m
const QUEUE_DELAY = 250; // 0.25s

interface QueuedItem {
  id: string;
  token: string;
  message: { content: string, embeds: MessageEmbed[] }
}

export default class MessageQueue {
  private queue: { [index: number]: QueuedItem };

  private queueHead: number;

  private queueTail: number;

  private backupInterval?: NodeJS.Timeout;

  private queueTimeout?: NodeJS.Timeout;

  constructor() {
    this.queue = {};
    this.queueHead = 0;
    this.queueTail = 0;
  }

  push(id: string, token: string, message: { content: string, embeds: MessageEmbed[] }) {
    this.enQueue({ id, token, message });

    if (!this.queueTimeout) {
      this.queueTimeout = setTimeout(() => this.notifyAsync(), QUEUE_DELAY);
    }
  }

  async startAsync() {
    if (await existsAsync('queue.json')) {
      this.queue = JSON.parse((await readFileAsync('queue.json')).toString());
    }

    this.backupInterval = setInterval(() => this.backupQueue(), BACKUP_INTERVAL);
  }

  async stopAsync() {
    await this.backupQueue();

    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    if (this.queueTimeout) {
      clearTimeout(this.queueTimeout);
    }
  }

  private backupQueue() {
    return writeFileAsync('queue.json', JSON.stringify(this.queue));
  }

  private async notifyAsync() {
    const { id, message, token } = this.deQueue()!;

    const body = {
      content: message.content,
      username: 'SteamWatch',
      avatar_url: 'https://cdn.discordapp.com/avatars/661531246417149952/af98c26218e92227800aa827c8876039.png',
      embeds: message.embeds,
    };

    let result;

    try {
      result = await fetch(`https://discordapp.com/api/webhooks/${id}/${token}`, {
        method: 'post',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      logger.error({
        group: 'MessageQueue',
        message: err,
      });

      this.enQueue({ id, message, token });
    }

    if (result && !result.ok) {
      const json = await result.json();

      if (json.code === Constants.APIErrors.UNKNOWN_WEBHOOK) {
        await MessageQueue.purgeWebhookAsync(id);
      } else {
        throw new Error(json.message);
      }
    }

    if (this.queueSize() > 0) {
      this.queueTimeout = setTimeout(() => this.notifyAsync(), QUEUE_DELAY);
    } else if (this.queueTimeout) {
      clearTimeout(this.queueTimeout);
    }
  }

  private enQueue(item: any) {
    this.queue[this.queueTail] = item;
    this.queueTail += 1;
  }

  private deQueue() {
    const size = this.queueTail - this.queueHead;

    if (size <= 0) {
      return undefined;
    }

    const item = this.queue[this.queueHead];

    delete this.queue[this.queueHead];

    this.queueHead += 1;

    // Reset the counter
    if (this.queueHead === this.queueTail) {
      this.queueHead = 0;
      this.queueTail = 0;
    }

    return item;
  }

  private queueSize() {
    return this.queueTail - this.queueHead;
  }

  private static async purgeWebhookAsync(id: string) {
    return db.delete()
      .from('channel_webhook')
      .where('id', id);
  }
}
