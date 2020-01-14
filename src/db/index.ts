import logger from '../logger';
import config from './config';
import env from '../env';

import Knex = require('knex');

const convertCamelToSnake = (value: string) => value.replace(/[A-Z]/g, (letter: string) => `_${letter.toLowerCase()}`);

const convertSnakeToCamel = (row: object) => Object.keys(row).map((key) => key.replace(/([-_]\w)/g, (g: string) => g[1].toUpperCase()));

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
  postProcessResponse: (result) => {
    if (Array.isArray(result)) {
      return result.map((row) => convertSnakeToCamel(row));
    }
    return convertSnakeToCamel(result);
  },
  wrapIdentifier: (value: string) => convertCamelToSnake(value),
} as Knex.Config);


export default db;
