import logger from '../logger';
import knex from './knex';

// eslint-disable-next-line no-unused-vars
import Knex = require('knex');

/**
 * Database context
 */
export default class DB {
  // Query builder
  public knex: Knex;

  constructor() {
    this.knex = knex;
  }

  async migrateAsync() {
    return this.knex.migrate.latest()
      .then(() => logger.info('Database ready'));
  }

  async getAppCountAsync() {
    return this.knex('app')
      .count('* AS count')
      .then((result) => result[0].count);
  }
}
