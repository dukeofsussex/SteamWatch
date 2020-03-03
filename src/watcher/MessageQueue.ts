// @ts-ignore Missing typings
import { Constants, RichEmbed } from 'discord.js';
import fetch from 'node-fetch';
import { existsSync, readFile, writeFile } from 'fs';
import { promisify } from 'util';
import db from '../db';
import logger from '../logger';

const BACKUP_INTERVAL = 60000; // 1m
const QUEUE_DELAY = 250; // 0.25s

const pExistsSync = promisify(existsSync);
const pReadFile = promisify(readFile);
const pWriteFile = promisify(writeFile);

export default class MessageQueue {
  private queue: { id: string, token: string, message: { content: string, embeds: RichEmbed[] } }[];

  private backupInterval?: NodeJS.Timeout;

  private queueTimeout?: NodeJS.Timeout;

  constructor() {
    this.queue = [];
  }

  push(id: string, token: string, message: { content: string, embeds: RichEmbed[] }) {
    this.queue.push({ id, token, message });

    if (!this.queueTimeout) {
      this.queueTimeout = setTimeout(() => this.notify(), QUEUE_DELAY);
    }
  }

  async startAsync() {
    if (await pExistsSync('queue.json')) {
      this.queue = JSON.parse((await pReadFile('queue.json')).toString());
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

  private async backupQueue() {
    return pWriteFile('queue.json', JSON.stringify(this.queue));
  }

  private async notify() {
    const { id, message, token } = this.queue.shift()!;

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

      this.queue.push({ id, message, token });
    }

    if (result && !result.ok) {
      const json = await result.json();

      if (json.code === Constants.APIErrors.UNKNOWN_WEBHOOK) {
        await MessageQueue.purgeWebhook(id);
      } else {
        throw new Error(json.message);
      }
    }

    if (this.queue.length > 0) {
      this.queueTimeout = setTimeout(() => this.notify(), QUEUE_DELAY);
    } else if (this.queueTimeout) {
      clearTimeout(this.queueTimeout);
    }
  }

  private static async purgeWebhook(id: string) {
    return db.delete()
      .from('channel_webhook')
      .where('id', id);
  }
}
