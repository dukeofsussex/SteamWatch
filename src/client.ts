import { CommandoClient } from 'discord.js-commando';
import { join } from 'path';
import DB from './db/db';
import logger from './logger';
import MariaDBProvider from './providers/mariadb';

export default class Client {
    /**
     * Commando client
     * @type {CommandoClient}
     */
    private client: CommandoClient;

    /**
     * Database context
     * @type {DB}
     */
    private db: DB;

    constructor() {
      this.client = new CommandoClient({
        commandPrefix: process.env.PREFIX,
        owner: process.env.OWNERS?.split(','),
        // TODO Add invite
      });

      this.db = new DB();
    }

    async startAsync() {
      await this.db.migrateAsync();

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

        const count = await this.db.getAppCountAsync();
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
