// eslint-disable-next-line no-unused-vars
import { Config } from 'knex';
import { join } from 'path';

const config = {
  client: 'mysql',
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  },
  migrations: {
    directory: join(__dirname, 'migrations'),
  },
  seeds: {
    directory: join(__dirname, 'seeds'),
  },
} as Config;

export default config;
