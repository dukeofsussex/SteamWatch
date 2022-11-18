import { logger, onShutdown } from '@steamwatch/shared';
import InteractionsManager from './InteractionsManager';

const interactionsManager = new InteractionsManager();

function exit() {
  process.exitCode = 1;
  interactionsManager.stop();
}

process.on('uncaughtException', (err, origin) => {
  logger.error({
    group: 'Process',
    message: err.message || origin,
    err,
  });
  exit();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({
    group: 'Process',
    message: reason,
    promise,
  });
  exit();
});

interactionsManager.start();
onShutdown(interactionsManager.stop.bind(interactionsManager));
