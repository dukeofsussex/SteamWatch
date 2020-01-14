import logger from '../logger';
import config from './config';
import env from '../env';

import Knex = require('knex');

const convertCamelToSnake = (value: string) => value.replace(/[A-Z]/g, (char: string) => `_${char.toLowerCase()}`);

const convertSnakeToCamel = (value: string) => value.replace(/([-_]\w)/g, (char: string) => char[1].toUpperCase());

const postProcessRow = (row: any): any => Object.keys(row).reduce(
  (result, key) => ({
    ...result,
    [convertSnakeToCamel(key)]: row[key],
  }),
  {},
);

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
      return result.map((row) => postProcessRow(row));
    }
    return postProcessRow(result);
  },
  wrapIdentifier: (value: string) => convertCamelToSnake(value),
} as Knex.Config);


export default db;
