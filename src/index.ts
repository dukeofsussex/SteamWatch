import ProcessManager from './ProcessManager';
import logger from './utils/logger';
import Util from './utils/Util';

const processManager = new ProcessManager();
processManager.start();
Util.onShutdown(processManager.stop.bind(processManager));

process.on('unhandledRejection', (err: any) => {
  logger.error(err);
  throw err;
});
