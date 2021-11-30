import ProcessManager from './ProcessManager';
import logger from './utils/logger';
import Util from './utils/Util';

const processManager = new ProcessManager();
processManager.start();
Util.onShutdown(processManager.stop.bind(processManager));

process.on('unhandledRejection', (err: Error) => {
  logger.error({
    group: 'Process',
    message: err.message,
    err,
  });
  throw err;
});
