import { join } from 'node:path';
import { config } from 'dotenv';

config({
  path: join(__dirname, '../../..', '.env'),
});

export default {
  discord: {
    appId: process.env['DISCORD_APP_ID'] || '',
    invite: process.env['DISCORD_INVITE'] || '',
    publicKey: process.env['DISCORD_APP_PUBLIC_KEY'] || '',
    token: process.env['DISCORD_BOT_TOKEN'] || '',
  },
  db: {
    database: process.env['DB_DATABASE'] || 'steam_watch',
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '3306', 10),
    user: process.env['DB_USER'] || 'root',
    password: process.env['DB_PASSWORD'] || '',
  },
  logging: {
    level: process.env['LOG_LEVEL'] || 'info',
  },
  server: {
    host: process.env['SERVER_HOST'] || '127.0.0.1',
    port: parseInt(process.env['SERVER_PORT'] || '8080', 10),
  },
  settings: {
    maxArticleLength: parseInt(process.env['SETTINGS_MAX_ARTICLE_LENGTH'] || '1000', 10),
    maxArticleNewlines: parseInt(process.env['SETTINGS_MAX_ARTICLE_NEWLINES'] || '10', 10),
    maxMentionsPerWatcher: parseInt(process.env['SETTINGS_MAX_MENTIONS_PER_WATCHER'] || '10', 10),
    maxWatchersPerGuild: parseInt(process.env['SETTINGS_MAX_WATCHERS_PER_GUILD'] || '10', 10),
    watcherRunFrequency: parseInt(process.env['SETTINGS_WATCHER_RUN_FREQUENCY'] || '4', 10),
  },
  steamWebApiKey: process.env['STEAM_WEB_API_KEY'] || '',
  debug: process.env['DEBUG'] === 'true',
  dev: process.env['NODE_ENV'] === 'development',
  devGuildId: process.env['DEV_GUILD_ID'] || '',
};
