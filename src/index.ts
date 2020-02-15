import Bot from './bot/Bot';

const SIGNALS: NodeJS.Signals[] = ['SIGHUP', 'SIGINT', 'SIGTERM', 'SIGUSR1', 'SIGUSR2'];

const bot = new Bot();
bot.startAsync();

process.on('unhandledRejection', (err) => {
  throw err;
});

for (let i = 0; i < SIGNALS.length; i += 1) {
  const event = SIGNALS[i];
  process.on(event, async () => {
    await bot.stopAsync();
    process.exit(0);
  });
}
