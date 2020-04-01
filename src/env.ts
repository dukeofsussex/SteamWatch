import { config } from 'dotenv';

const { homepage } = require('../package.json');

const result = config();

if (result.error) {
  throw result.error;
}

export default {
  bot: {
    invite: process.env.BOT_INVITE || '',
    owners: process.env.BOT_OWNERS?.split(',') || [],
    prefix: process.env.BOT_PREFIX || 'sw',
    token: process.env.BOT_TOKEN || '',
  },
  db: {
    database: process.env.DB_DATABASE || 'steam_watch',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  settings: {
    maxArticleLength: parseInt(process.env.SETTINGS_MAX_ARTICLE_LENGTH || '1000', 10),
    maxArticleNewlines: parseInt(process.env.SETTINGS_MAX_ARTICLE_NEWLINES || '10', 10),
    maxMentionsPerWatcher: parseInt(process.env.SETTINGS_MAX_MENTIONS_PER_WATCHER || '10', 10),
    maxWatchersPerGuild: parseInt(process.env.SETTINGS_MAX_WATCHERS_PER_GUILD || '10', 10),
  },
  debug: process.env.DEBUG === 'true',
  dev: process.env.NODE_ENV === 'development',
  repoUrl: homepage.split('#')[0],
  websiteUrl: 'https://steam.watch',
};
