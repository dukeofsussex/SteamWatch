import { readdirSync } from 'fs';
import { join } from 'path';
import db from './db';
import env from './env';
import logger from './logger';
import SteamWatchClient from './structures/SteamWatchClient';
import Manager from './jobs/Manager';
import MariaDBProvider from './commando/providers/MariaDB';
import MentionListType from './commando/types/MentionList';
import Steam from './steam/Steam';

export default class Bot {
  private client: SteamWatchClient;

  private manager: Manager;

  constructor() {
    this.client = new SteamWatchClient({
      commandPrefix: env.bot.prefix,
      invite: env.bot.invite,
      messageCacheMaxSize: 1,
      owner: env.bot.owners,
      steam: new Steam(),
      unknownCommandResponse: false,
    });
    this.manager = new Manager(this.client);
  }

  async startAsync() {
    if (!env.debug) {
      await db.migrate.latest();
      await db.seed.run();
    }

    logger.info('Database ready');

    this.client.setProvider(new MariaDBProvider());

    this.client.registry
      .registerDefaultTypes()
      .registerType(MentionListType)
      .registerDefaultGroups()
      .registerGroups([['apps', 'Apps']])
      .registerCommandsIn({
        filter: /^([^.].*)\.(js|ts)$/,
        dirname: join(__dirname, 'commands'),
      });

    this.client.once('ready', async () => {
      logger.info(`Logged in as '${this.client.user.tag}'`);

      this.setActivity();
      this.manager.start();
    });

    this.client.setInterval(() => this.setActivity(), 90000);

    if (env.debug) {
      this.client.on('debug', (message) => logger.debug(message));
    }

    this.client.on('warn', (message) => logger.warn(message));
    this.client.on('error', (err) => logger.error(err));
    this.client.on('reconnecting', () => logger.warn('Reconnecting'));
    this.client.on('commandError', (_, err, message) => logger.error(`${message.content} : ${err}`));

    readdirSync(join(__dirname, 'events'))
      .forEach(async (eventFile) => {
        const eventHandler = await import(join(__dirname, 'events', eventFile));
        this.client.on(eventFile.split('.')[0], eventHandler.default);
      });

    this.client.login(env.bot.token);
  }

  async stopAsync() {
    this.manager.stop();
    await this.client.destroy();
    this.client.removeAllListeners();
  }

  private async setActivity() {
    const count = await db.count('* AS count')
      .from('app')
      .innerJoin('app_watcher', 'app_watcher.app_id', 'app.id')
      .first()
      .then((res: any) => res.count);

    this.client.user.setActivity(
      `${count} apps for ${this.client.guilds.size} guilds | ${this.client.commandPrefix}help`,
      { type: 'WATCHING' },
    );
  }
}
