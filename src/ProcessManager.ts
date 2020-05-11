import { Shard, ShardingManager } from 'discord.js';
import { extname, join } from 'path';
import db from './db';
import env from './env';
import logger from './logger';
import WatcherManager from './watcher';

export default class ProcessManager {
  private shardingManager?: ShardingManager;

  private watcherManager?: WatcherManager;

  async startAsync() {
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

    if (!process.argv.includes('--no-bot')) {
      this.shardAsync();
    }

    if (!process.argv.includes('--no-watcher')) {
      this.watch();
    }
  }

  async stopAsync() {
    logger.info({
      group: 'Process',
      message: 'Shutting down',
    });
    await this.watcherManager?.stopAsync();
    setTimeout(() => {
      db.destroy();
      logger.end(() => {
        process.exit(0);
      });
    }, 5000);
  }

  private async shardAsync() {
    this.shardingManager = new ShardingManager(join(__dirname, 'bot', `index${extname(__filename)}`), {
      token: env.bot.token,
      execArgv: process.execArgv,
    });

    this.shardingManager.on('shardCreate', (shard: Shard) => {
      logger.info({
        group: 'Shard',
        message: `#${shard.id} launched`,
      });
      shard.on('death', () => logger.warn({
        group: 'Shard',
        message: `#${shard.id} died`,
      }))
        .on('ready', () => () => logger.info({
          group: 'Shard',
          message: `#${shard.id} ready`,
        }))
        .on('disconnect', () => logger.info({
          group: 'Shard',
          message: `#${shard.id} disconnected`,
        }))
        .on('reconnecting', () => logger.info({
          group: 'Shard',
          message: `#${shard.id} reconnecting`,
        }));
    });

    this.shardingManager.spawn();
  }

  private watch() {
    this.watcherManager = new WatcherManager();
    this.watcherManager.startAsync();
  }
}
