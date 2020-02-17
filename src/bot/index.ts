import Bot from './Bot';

const bot = new Bot();
bot.startAsync();

const SIGNALS: NodeJS.Signals[] = ['SIGHUP', 'SIGINT', 'SIGTERM', 'SIGUSR2'];

process.on('unhandledRejection', (err) => {
  throw err;
});


for (let i = 0; i < SIGNALS.length; i += 1) {
  const event = SIGNALS[i];
  process.on(event, async () => {
    await bot.stopAsync();
  });
}
