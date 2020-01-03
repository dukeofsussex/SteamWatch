import Knex from 'knex';
import config from './config';
import logger from '../logger';

const debug = process.env.NODE_ENV === 'DEVELOPMENT';

const knex: Knex = Knex({
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

export default knex;
