import logger from './logger';

export interface Manager {
  start(): Promise<void> | void;
  stop(): Promise<void> | void;
}

const SIGNALS: NodeJS.Signals[] = ['SIGHUP', 'SIGINT', 'SIGTERM', 'SIGUSR2'];

export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function onShutdown(callback: () => void) {
  for (let i = 0; i < SIGNALS.length; i += 1) {
    const event = SIGNALS[i] as NodeJS.Signals;
    process.on(event, callback);
  }
}

export function partition<T>(
  array: T[],
  callback: (element: T, index: number, array: T[]) => boolean,
) {
  return array.reduce(
    (result, element, i) => {
      result[callback(element, i, array) ? 0 : 1]!.push(element);
      return result;
    },
    [[], []] as [T[], T[]],
  );
}

export function run(Manager: new() => Manager) {
  const manager = new Manager();

  function exit() {
    process.exitCode = 1;
    manager.stop();
  }

  process.on('uncaughtException', (err, origin) => {
    logger.error({
      label: 'Process:uncaughtException',
      message: err.message || origin,
      err,
    });
    exit();
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error({
      label: 'Process:unhandledRejection',
      message: reason,
      promise,
    });
    exit();
  });

  manager.start();
  onShutdown(manager.stop.bind(manager));
}
