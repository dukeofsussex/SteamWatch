import { Shard, ShardingManager } from 'discord.js';
import { existsSync } from 'fs';
import { join } from 'path';
import env from './env';
import Manager from './watcher';
import logger from './logger';

const SIGNALS: NodeJS.Signals[] = ['SIGHUP', 'SIGINT', 'SIGTERM', 'SIGUSR2'];
let shardingManager: ShardingManager;
let manager: Manager;

if (!process.argv.includes('--no-bot')) {
  let botFilePath = join(__dirname, 'bot', 'index.js');
  if (!existsSync(botFilePath)) {
    botFilePath = join(__dirname, 'bot', 'index.ts');
  }

  shardingManager = new ShardingManager(botFilePath, {
    token: env.bot.token,
  });

  shardingManager.on('launch', (shard: Shard) => {
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

  shardingManager.spawn();
}

if (!process.argv.includes('--no-watcher')) {
  // TODO Change manager to no longer require the client
  // manager = new Manager();
  // manager.start();
}

process.on('unhandledRejection', (err) => {
  throw err;
});

for (let i = 0; i < SIGNALS.length; i += 1) {
  const event = SIGNALS[i];
  process.on(event, async () => {
    logger.info({
      group: 'Shard',
      message: 'All shutting down',
    });
    manager?.stop();
    setTimeout(() => {
      logger.destroy();
      process.exit(0);
    }, 5000);
  });
}
