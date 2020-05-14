import { oneLine } from 'common-tags';
import { RateLimitData } from 'discord.js';
import { ArgumentType } from 'discord.js-commando';
import fetch from 'node-fetch';
import { join } from 'path';
import MariaDBProvider from './commando/providers/MariaDB';
import SteamWatchClient from './structures/SteamWatchClient';
import db from '../db';
import env from '../env';
import logger from '../logger';
import Steam from '../steam/Steam';
import { readdirAsync } from '../utils/fsAsync';

export default class Bot {
  private client: SteamWatchClient;

  constructor() {
    this.client = new SteamWatchClient({
      commandPrefix: env.bot.prefix,
      invite: env.bot.invite,
      messageCacheMaxSize: 1,
      owner: env.bot.owners,
      steam: new Steam(),
      ws: {
        intents: [
          'DIRECT_MESSAGES',
          'GUILDS',
          'GUILD_BANS',
          'GUILD_MEMBERS',
          'GUILD_MESSAGES',
          'GUILD_WEBHOOKS',
        ],
      },
    });
  }

  async startAsync() {
    this.client.setProvider(new MariaDBProvider());

    this.client.registry
      .registerDefaultTypes()
      .registerTypesIn({
        filter: /^([^.].*)\.(?:js|ts)$/,
        dirname: join(__dirname, 'commando', 'types'),
        resolve: (a: { default: ArgumentType }) => a.default,
      })
      .registerGroups([['apps', 'Apps'], ['utils', 'Utils']])
      .registerCommandsIn({
        filter: /^([^.].*)\.(?:js|ts)$/,
        dirname: join(__dirname, 'commands'),
      });

    this.registerEventsAsync();

    this.client.login(env.bot.token);
  }

  async stopAsync() {
    this.client.destroy();
    db.destroy();
  }

  private async registerEventsAsync() {
    if (env.debug) {
      this.client.on('debug', (message) => logger.debug({ group: 'Discord', message }));
    }

    this.client.on('commandError', (_, err, message) => logger.error({
      group: 'Commando',
      message: `${message.content} : ${err}\n${err.stack}`,
    }));
    this.client.on('error', (err) => logger.error({ group: 'Discord', message: err }));
    this.client.on('warn', (message) => logger.warn({ group: 'Discord', message }));
    this.client.on('rateLimit', (data: RateLimitData) => logger.warn({
      group: 'Discord',
      message: `Limit of ${data.limit} for ${data.method} ${data.path}`,
    }));

    this.client.once('ready', () => {
      logger.info({
        group: 'Discord',
        message: `Logged in as '${this.client.user!.tag}'`,
      });

      this.updateStatusAsync();
      this.client.setInterval(() => this.updateStatusAsync(), 900000);
    });

    const eventFiles = (await readdirAsync(join(__dirname, 'events')))
      .filter((file) => !file.endsWith('.map'));
    const eventHandlers = await Promise
      .all(eventFiles.map((file) => import(join(__dirname, 'events', file))));
    eventFiles.forEach((file, i) => {
      this.client.on(file.split('.')[0], eventHandlers[i].default);
    });
  }

  private async updateStatusAsync() {
    const counts = await Promise.all([
      db.countDistinct('app_id AS count')
        .from('app_watcher')
        .first()
        .then((res: any) => res.count),
      db.count('* AS count')
        .from('guild')
        .whereNot('id', 0)
        .first()
        .then((res: any) => res.count),
    ]);

    this.client.user!.setActivity(
      oneLine`
        ${counts[0]} apps for ${counts[1]} guilds
        | ${this.client.commandPrefix}${this.client.commandPrefix.length > 1 ? ' ' : ''}help
      `,
      { type: 'WATCHING' },
    );

    if (this.client.shard?.ids.includes(0) && process.env.TOPGG_TOKEN) {
      fetch('https://top.gg/api/bots/stats', {
        headers: {
          authorization: process.env.TOPGG_TOKEN,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          server_count: counts[1],
          shard_id: 0,
          shard_count: this.client.shard.count,
        }),
        method: 'POST',
      }).then((res) => res.json())
        .then((res) => logger.log({
          group: 'Top.gg',
          message: res.error || 'Status updated',
          level: res.error ? 'error' : 'debug',
        }))
        .catch((err) => logger.error({
          group: 'Top.gg',
          message: err,
        }));
    }
  }
}
