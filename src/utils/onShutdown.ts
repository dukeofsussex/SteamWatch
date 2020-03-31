const SIGNALS: NodeJS.Signals[] = ['SIGHUP', 'SIGINT', 'SIGTERM', 'SIGUSR2'];

process.on('unhandledRejection', (err) => {
  throw err;
});

export default function onShutdown(callback: Function) {
  for (let i = 0; i < SIGNALS.length; i += 1) {
    const event = SIGNALS[i];
    process.on(event, () => callback());
  }
}
