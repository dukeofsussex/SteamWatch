import { extname, join } from 'node:path';
import env from '../env';

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
    loadExtensions: [extname(__filename)],
  },
  seeds: {
    directory: join(__dirname, 'seeds'),
    loadExtensions: [extname(__filename)],
  },
};
