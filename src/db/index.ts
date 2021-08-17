import { knex } from 'knex';
import config from './config';
import env from '../utils/env';
import logger from '../utils/logger';

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

export default knex({
  ...config,
  asyncStackTraces: env.dev,
  debug: env.debug,
  log: {
    debug(message: string) {
      return logger.debug({
        group: 'Database',
        message,
      });
    },
    error(message: string) {
      return logger.error({
        group: 'Database',
        message,
      });
    },
    warn(message: string) {
      return logger.warn({
        group: 'Database',
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
