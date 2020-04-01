import Bot from './Bot';
import onShutdown from '../utils/onShutdown';

const bot = new Bot();
bot.startAsync();
onShutdown(bot.stopAsync.bind(bot));
