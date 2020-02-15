import Bot from './bot';
import Manager from './watcher';

const SIGNALS: NodeJS.Signals[] = ['SIGHUP', 'SIGINT', 'SIGTERM', 'SIGUSR1', 'SIGUSR2'];
let bot: Bot;
let manager: Manager;

if (!process.argv.includes('--no-bot')) {
  bot = new Bot();
  bot.startAsync();
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
    await bot?.stopAsync();
    manager?.stop();
    process.exit(0);
  });
}
