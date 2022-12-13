import {
  db,
  env,
  logger,
  Manager,
} from '@steamwatch/shared';
import MessageQueue from './MessageQueue';
import SteamGatewayManager from './managers/SteamGatewayManager';
import NewsWatcher from './watchers/NewsWatcher';
import PriceWatcher from './watchers/PriceWatcher';
import UGCWatcher from './watchers/UGCWatcher';
import WorkshopWatcher from './watchers/WorkshopWatcher';
import BroadcastWorker from './workers/BroadcastWorker';
import GuildWorker from './workers/GuildWorker';
import TopGGWorker from './workers/TopGGWorker';

export default class ProcessManager implements Manager {
  private processes: Manager[];

  constructor() {
    const messageQueue = new MessageQueue();

    this.processes = [
      messageQueue,
      new NewsWatcher(messageQueue),
      new PriceWatcher(messageQueue),
      new UGCWatcher(messageQueue),
      new WorkshopWatcher(messageQueue),
      new BroadcastWorker(messageQueue),
      new GuildWorker(),
      new TopGGWorker(),
      new SteamGatewayManager(),
    ];
  }

  async start() {
    logger.info('Initializing...');

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
