import { oneLine } from 'common-tags';
import { RateLimitInfo } from 'discord.js';
import { ArgumentType } from 'discord.js-commando';
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
      unknownCommandResponse: false,
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
      .registerDefaultGroups()
      .registerGroups([['apps', 'Apps']])
      .registerCommandsIn({
        filter: /^([^.].*)\.(?:js|ts)$/,
        dirname: join(__dirname, 'commands'),
      });

    this.client.once('ready', () => {
      logger.info({
        group: 'Discord',
        message: `Logged in as '${this.client.user.tag}'`,
      });

      if (this.client.shard.id === 0) {
        this.setActivityAsync();
      }
    });

    if (this.client.shard.id === 0) {
      this.client.setInterval(() => this.setActivityAsync(), 300000);
    }

    if (env.debug) {
      this.client.on('debug', (message) => logger.debug({ group: 'Discord', message }));
    }

    this.client.on('commandError', (_, err, message) => logger.error({
      group: 'Commando',
      message: `${message.content} : ${err}`,
    }));
    this.client.on('disconnect', () => logger.info({ group: 'Discord', message: 'Disconnected' }));
    this.client.on('error', (err) => logger.error({ group: 'Discord', message: err }));
    this.client.on('warn', (message) => logger.warn({ group: 'Discord', message }));
    this.client.on('rateLimit', (info: RateLimitInfo) => logger.warn({
      group: 'Discord',
      message: `Limit of ${info.limit} for ${info.method} ${info.path}`,
    }));
    this.client.on('reconnecting', () => logger.info({
      group: 'Discord',
      message: 'Reconnecting',
    }));
    this.client.on('resume', (replayed: number) => logger.info({
      group: 'Discord',
      message: `Resuming, replayed ${replayed} events`,
    }));

    const eventFiles = (await readdirAsync(join(__dirname, 'events')))
      .filter((file) => !file.endsWith('.map'));
    const eventHandlers = await Promise
      .all(eventFiles.map((file) => import(join(__dirname, 'events', file))));
    eventFiles.forEach((file, i) => {
      this.client.on(file.split('.')[0], eventHandlers[i].default);
    });

    this.client.login(env.bot.token);
  }

  async stopAsync() {
    await this.client.destroy();
    db.destroy();
  }

  private async setActivityAsync() {
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

    this.client.user.setActivity(
      oneLine`
        ${counts[0]} apps for ${counts[1]} guilds
        | ${this.client.commandPrefix}${this.client.commandPrefix.length > 1 ? ' ' : ''}help
      `,
      { type: 'WATCHING' },
    );
  }
}
