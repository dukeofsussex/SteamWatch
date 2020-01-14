import logger from '../logger';
import config from './config';
import env from '../env';

import Knex = require('knex');


const db: Knex = Knex({
  ...config,
  asyncStackTraces: env.debug,
  debug: env.debug,
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
