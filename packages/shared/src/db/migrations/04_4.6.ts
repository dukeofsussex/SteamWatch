// eslint-disable-next-line import/no-import-module-exports
import type { Knex } from 'knex';

exports.up = (knex: Knex) => knex.schema
  .alterTable('app_workshop', (table) => {
    table.datetime('last_new')
      .after('last_checked_new');
    table.datetime('last_update')
      .after('last_checked_update');
  })
  .raw('UPDATE app_workshop SET last_new = last_checked_new, last_update = last_checked_update')
  .alterTable('forum', (table) => {
    table.datetime('last_post')
      .after('last_checked');
  })
  .raw('UPDATE app_workshop SET last_post = last_checked')
  .alterTable('ugc', (table) => {
    table.datetime('last_update')
      .after('last_checked');
  })
  .raw('UPDATE ugc SET last_update = last_checked');
exports.down = (knex: Knex) => knex.schema
  .alterTable('app_workshop', (table) => {
    table.dropColumns('last_new', 'last_update');
  })
  .alterTable('forum', (table) => {
    table.dropColumn('last_post');
  })
  .alterTable('ugc', (table) => {
    table.dropColumn('last_update');
  });
