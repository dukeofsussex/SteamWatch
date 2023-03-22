// eslint-disable-next-line import/no-import-module-exports
import type { Knex } from 'knex';

exports.up = (knex: Knex) => knex.schema
  .alterTable('guild', (table) => {
    table.integer('currency_id')
      .unsigned()
      .alter();
  })
  .alterTable('watcher', (table) => {
    table.integer('app_id')
      .unsigned()
      .alter();
  })
  .raw('UPDATE watcher SET app_id = NULL WHERE ugc_id IS NOT NULL');

exports.down = (knex: Knex) => knex.schema
  .raw('DELETE FROM guild WHERE currency_id IS NULL')
  .alterTable('guild', (table) => {
    table.integer('currency_id')
      .unsigned()
      .notNullable()
      .alter();
  })
  .raw('UPDATE watcher SET app_id = (SELECT app_id FROM ugc WHERE id = ugc_id) WHERE ugc_id IS NOT NULL')
  .alterTable('watcher', (table) => {
    table.integer('app_id')
      .unsigned()
      .notNullable()
      .alter();
  });
