import logger from '../logger';
import config from './config';

import Knex = require('knex');

const debug = process.env.NODE_ENV === 'development';

const db: Knex = Knex({
  ...config,
  asyncStackTraces: debug,
  debug,
  log: {
    debug(message: string) {
      return logger.debug(message);
    },
    error(message: string) {
      return logger.error(message);
    },
    warn(message: string) {
      return logger.warn(message);
    },
  },
} as Knex.Config);


export default db;
