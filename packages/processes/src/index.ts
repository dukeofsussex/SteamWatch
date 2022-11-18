import { logger, onShutdown } from '@steamwatch/shared';
import ProcessManager from './ProcessManager';

const processManager = new ProcessManager();

function exit() {
  process.exitCode = 1;
  processManager.stop();
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

processManager.start();
onShutdown(processManager.stop.bind(processManager));
