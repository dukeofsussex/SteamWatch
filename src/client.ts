import { CommandoClient } from 'discord.js-commando';
import { join } from 'path';
import db from './db';
import env from './env';
import logger from './logger';
import MariaDBProvider from './providers/mariadb';
import Manager from './tasks/manager';
import steam from './steam/steam';
import MentionListType from './types/mentionList';

export default class Client {
  private client: CommandoClient;

  private manager: Manager;

  constructor() {
    this.client = new CommandoClient({
      commandPrefix: env.bot.prefix,
      owner: env.bot.owners,
      messageCacheMaxSize: 1,
    });
    this.manager = new Manager(this.client);
  }

  async startAsync() {
    steam.init();

    await db.migrate.latest();
    await db.seed.run();

    logger.info('Database ready');

    this.client.setProvider(new MariaDBProvider());

    this.client.registry
      .registerDefaultTypes()
      .registerType(MentionListType)
      .registerDefaultGroups()
      .registerGroups([['apps', 'Apps']])
      .registerDefaultCommands({
        eval_: false,
        commandState: false,
      })
      .registerCommandsIn({
        filter: /^([^.].*)\.(js|ts)$/,
        dirname: join(__dirname, 'commands'),
      });

    this.client.once('ready', async () => {
      logger.info(`Logged in as '${this.client.user.tag}'`);

      const count = await db.count('* AS count')
        .from('app')
        .first()
        .then((res: any) => res.count);

      this.client.user.setActivity(`${count} apps`, { type: 'WATCHING' });
      this.manager.start();
    });

    if (env.debug) {
      this.client.on('debug', (message) => logger.debug(message));
    }

    this.client.on('warn', (message) => logger.warn(message));
    this.client.on('error', (err) => logger.error(err));

    this.client.login(env.bot.token);

    process.on('unhandledRejection', (_, promise) => {
      logger.error(promise);
    });

    process.on('SIGHUP', () => this.stopAsync());
    process.on('SIGINT', () => this.stopAsync());
    process.on('SIGTERM', () => this.stopAsync());
  }

  async stopAsync() {
    steam.quit();
    this.manager.stop();
    await this.client.destroy();
  }
}
