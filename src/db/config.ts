import { Config } from 'knex';
import { join } from 'path';
import env from '../env';

const config = {
  client: 'mysql',
  connection: {
    ...env.db,
    bigNumberStrings: true,
    charset: 'utf8mb4',
    supportBigNumbers: true,
    timezone: 'Z',
  },
  migrations: {
    directory: join(__dirname, 'migrations'),
  },
  seeds: {
    directory: join(__dirname, 'seeds'),
  },
} as Config;

export default config;
