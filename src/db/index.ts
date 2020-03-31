import config from './config';
import env from '../env';
import logger from '../logger';

import Knex = require('knex');

const convertCamelToSnake = (value: string) => value.replace(/[A-Z]/g, (char: string) => `_${char.toLowerCase()}`);

const convertSnakeToCamel = (value: string) => value.replace(/([-_]\w)/g, (char: string) => char[1].toUpperCase());

const postProcessRow = (row: any): any => {
  if (typeof row !== 'object' || row === null) {
    return row;
  }

  return Object.entries(row).reduce((result, [key, value]) => ({
    ...result,
    [convertSnakeToCamel(key)]: value,
  }), {});
};

export default Knex({
  ...config,
  asyncStackTraces: env.debug,
  debug: env.debug,
  log: {
    debug(message: string) {
      return logger.debug({
        group: 'Knex',
        message,
      });
    },
    error(message: string) {
      return logger.error({
        group: 'Knex',
        message,
      });
    },
    warn(message: string) {
      return logger.warn({
        group: 'Knex',
        message,
      });
    },
  },
  postProcessResponse: (result) => {
    if (Array.isArray(result)) {
      return result.map((row) => postProcessRow(row));
    }

    if (result) {
      return postProcessRow(result);
    }

    return result;
  },
  wrapIdentifier: (value: string) => convertCamelToSnake(value),
});
