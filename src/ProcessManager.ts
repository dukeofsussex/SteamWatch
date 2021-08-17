import db from './db';
import InteractionsManager from './interactions/InteractionsManager';
import { Manager } from './types';
import env from './utils/env';
import logger from './utils/logger';
import WatcherManager from './watcher/WatcherManager';
import GuildWorker from './workers/GuildWorker';
import TopGGWorker from './workers/TopGGWorker';

export default class ProcessManager implements Manager {
  private processes: Manager[];

  constructor() {
    this.processes = [
      new GuildWorker(),
      new InteractionsManager(),
      new TopGGWorker(),
      new WatcherManager(),
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
      const process = this.processes[i];

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
      const process = this.processes[i];

      // eslint-disable-next-line no-await-in-loop
      await process.stop();
    }

    setTimeout(() => {
      db.destroy();
      logger.end(() => {
        process.exit(0);
      });
    }, 5000);
  }
}
