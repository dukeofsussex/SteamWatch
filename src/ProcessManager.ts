import { Shard, ShardingManager } from 'discord.js';
import { existsSync } from 'fs';
import { join } from 'path';
import env from './env';
import WatcherManager from './watcher';
import logger from './logger';
import db from './db';

export default class ProcessManager {
  private shardingManager?: ShardingManager;

  private watcherManager?: WatcherManager;

  async startAsync() {
    if (!process.argv.includes('--no-bot')) {
      this.shard();
    }

    if (!process.argv.includes('--no-watcher')) {
      this.watch();
    }
  }

  stop() {
    logger.info({
      group: 'Shard',
      message: 'All shutting down',
    });
    this.watcherManager?.stop();
    setTimeout(() => {
      db.destroy();
      logger.destroy();
      process.exit(0);
    }, 5000);
  }

  private shard() {
    let botFilePath = join(__dirname, 'bot', 'index.js');
    if (!existsSync(botFilePath)) {
      botFilePath = join(__dirname, 'bot', 'index.ts');
    }

    this.shardingManager = new ShardingManager(botFilePath, {
      token: env.bot.token,
    });

    this.shardingManager.on('launch', (shard: Shard) => {
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
  // TODO Change manager to no longer require the client
  // this.watcherManager = new Manager();
  // this.watcherManager.start();
  }
}
