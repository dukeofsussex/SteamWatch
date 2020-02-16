import ProcessManager from './ProcessManager';

const SIGNALS: NodeJS.Signals[] = ['SIGHUP', 'SIGINT', 'SIGTERM', 'SIGUSR2'];

const processManager = new ProcessManager();
processManager.startAsync();

process.on('unhandledRejection', (err) => {
  throw err;
});

for (let i = 0; i < SIGNALS.length; i += 1) {
  const event = SIGNALS[i];
  process.on(event, () => processManager.stop());
}
