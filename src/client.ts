import { CommandoClient } from 'discord.js-commando';
import { join } from 'path';
import db from './db';
import logger from './logger';
import MariaDBProvider from './providers/mariadb';

// eslint-disable-next-line no-unused-vars
import Knex = require('knex');

export default class Client {
    private client: CommandoClient;

    // Database context
    private db: Knex;

    constructor() {
      this.client = new CommandoClient({
        commandPrefix: process.env.PREFIX,
        owner: process.env.OWNERS?.split(','),
        // TODO Add invite
      });

      this.db = db;
    }

    async startAsync() {
      await this.db.migrate.latest();

      logger.info('Database ready');

      this.client.setProvider(new MariaDBProvider());

      this.client.registry
        .registerDefaultTypes()
        .registerDefaultGroups()
        .registerGroups([['apps', 'Apps']])
        .registerDefaultCommands({
          eval_: false,
        })
        // .registerCommands(commands)
        .registerCommandsIn({
          filter: /^([^.].*)\.(js|ts)?$/,
          dirname: join(__dirname, 'commands'),
        });

      this.client.once('ready', async () => {
        logger.info(`Logged in as '${this.client.user.tag}'`);

        const count = await this.db('app')
          .count('* AS count')
          .then((result) => result[0].count);

        this.client.user.setActivity(`${count} apps`, { type: 'WATCHING' });
      });

      if (process.env.NODE_ENV === 'DEVELOPMENT') {
        this.client.on('debug', (message) => logger.debug(message));
      }

      this.client.on('warn', (message) => logger.warn(message));
      this.client.on('error', (err) => logger.error(err));

      this.client.login(process.env.TOKEN);

      process.on('unhandledRejection', (err) => {
        logger.error(err || 'Unhandled rejection');
        process.exit(1);
      });
    }
}
