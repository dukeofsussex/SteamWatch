import { join } from 'path';
import env from '../utils/env';

export default {
  client: 'mysql',
  connection: {
    ...env.db,
    bigNumberStrings: true,
    charset: 'utf8mb4',
    supportBigNumbers: true,
    timezone: 'utc',
  },
  migrations: {
    directory: join(__dirname, 'migrations'),
  },
  seeds: {
    directory: join(__dirname, 'seeds'),
  },
};
