import { config } from 'dotenv';

const result = config();

if (result.error) {
  throw result.error;
}

const env = {
  bot: {
    delay: parseInt(process.env.BOT_DELAY || '5', 10),
    invite: process.env.BOT_INVITE || '',
    maxAppsPerGuild: parseInt(process.env.BOT_MAX_APPS_PER_GUILD || '10', 10),
    owners: process.env.BOT_OWNERS?.split(',') || [],
    prefix: process.env.BOT_PREFIX || '$',
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
  debug: process.env.NODE_ENV === 'development',
};

export default env;
