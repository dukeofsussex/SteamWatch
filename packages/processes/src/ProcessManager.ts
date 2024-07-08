import {
  db,
  env,
  logger,
  Manager,
  steamClient,
  WorkshopType,
} from '@steamwatch/shared';
import MessageQueue from './MessageQueue';
import CuratorWatcher from './watchers/CuratorWatcher';
import ForumWatcher from './watchers/ForumWatcher';
import FreeWatcher from './watchers/FreeWatcher';
import GroupWatcher from './watchers/GroupWatcher';
import NewsWatcher from './watchers/NewsWatcher';
import PriceWatcher from './watchers/PriceWatcher';
import UGCWatcher from './watchers/UGCWatcher';
import WorkshopWatcher from './watchers/WorkshopWatcher';
import GuildWorker from './workers/GuildWorker';
import SteamGatewayWorker from './workers/SteamGatewayWorker';
import TopGGWorker from './workers/TopGGWorker';

export default class ProcessManager implements Manager {
  private processes: Manager[];

  constructor() {
    const messageQueue = new MessageQueue();

    this.processes = [
      messageQueue,
      new CuratorWatcher(messageQueue),
      new ForumWatcher(messageQueue),
      new FreeWatcher(messageQueue),
      new GroupWatcher(messageQueue),
      new NewsWatcher(messageQueue),
      new PriceWatcher(messageQueue),
      new UGCWatcher(messageQueue),
      new WorkshopWatcher(messageQueue, WorkshopType.App),
      new WorkshopWatcher(messageQueue, WorkshopType.User),
      new GuildWorker(),
      new SteamGatewayWorker(),
      new TopGGWorker(),
    ];
  }

  async start() {
    logger.info('Initializing...');

    steamClient.logOn({ anonymous: true });

    if (!env.dev) {
      await db.migrate.latest();
      logger.info('Database migrated');
      await db.seed.run();
      logger.info('Database seeded');
    }

    logger.info('Database ready');

    for (let i = 0; i < this.processes.length; i += 1) {
      const process = this.processes[i] as Manager;

      logger.info(`Starting ${process.constructor.name}...`);

      // eslint-disable-next-line no-await-in-loop
      await process.start();
    }

    logger.info('Processes started');
  }

  async stop() {
    logger.info('Shutting down...');

    for (let i = 0; i < this.processes.length; i += 1) {
      const process = this.processes[i] as Manager;

      logger.info(`Stopping ${process.constructor.name}...`);

      // eslint-disable-next-line no-await-in-loop
      await process.stop();
    }

    logger.info('Processes stopped');

    await db.destroy();
    process.exit(process.exitCode || 0);
  }
}
