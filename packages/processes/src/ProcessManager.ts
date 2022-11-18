import {
  db,
  env,
  logger,
  Manager,
} from '@steamwatch/shared';
import MessageQueue from './MessageQueue';
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
    ];
  }

  async start() {
    logger.info({
      group: 'Process',
      message: 'Initializing...',
    });

    if (!env.dev) {
      await db.migrate.latest();
      await db.seed.run();
      logger.info({
        group: 'Database',
        message: 'Migrated and seeded',
      });
    }

    logger.info({
      group: 'Database',
      message: 'Ready',
    });

    for (let i = 0; i < this.processes.length; i += 1) {
      const process = this.processes[i] as Manager;

      logger.info({
        group: 'Process',
        message: `Starting ${process.constructor.name}...`,
      });

      // eslint-disable-next-line no-await-in-loop
      await process.start();
    }
  }

  async stop() {
    logger.info({
      group: 'Process',
      message: 'Shutting down...',
    });

    for (let i = 0; i < this.processes.length; i += 1) {
      const process = this.processes[i] as Manager;

      logger.info({
        group: 'Process',
        message: `Stopping ${process.constructor.name}...`,
      });

      // eslint-disable-next-line no-await-in-loop
      await process.stop();
    }

    await db.destroy();
    process.exit(process.exitCode || 0);
  }
}
