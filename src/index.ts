import Bot from './Bot';
import logger from './logger';

const SIGNALS: NodeJS.Signals[] = ['SIGHUP', 'SIGINT', 'SIGTERM', 'SIGUSR1', 'SIGUSR2'];

const bot = new Bot();
bot.startAsync();

process.on('unhandledRejection', (_, promise) => {
  logger.error(promise);
});

for (let i = 0; i < SIGNALS.length; i += 1) {
  const event = SIGNALS[i];
  process.on(event, () => bot.stopAsync());
}
