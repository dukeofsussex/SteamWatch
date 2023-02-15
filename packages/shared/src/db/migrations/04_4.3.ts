// eslint-disable-next-line import/no-import-module-exports
import type { Knex } from 'knex';

exports.up = (knex: Knex) => knex.schema
  .alterTable('group', (table) => {
    table.renameColumn('last_checked', 'last_checked_news');
    table.integer('last_reviewed_app_id')
      .unsigned()
      .after('last_checked');
    table.datetime('last_checked_reviews')
      .after('last_reviewed_app_id');
    table.foreign('last_reviewed_app_id')
      .references('id')
      .inTable('app')
      .onUpdate('CASCADE')
      .onDelete('SET NULL');
  })
  .alterTable('watcher', (table) => {
    table.enum('type', ['curator', 'group', 'news', 'price', 'ugc', 'workshop'])
      .alter();
  });

exports.down = (knex: Knex) => knex.schema
  .alterTable('group', (table) => {
    table.dropForeign('last_reviewed_app_id');
    table.renameColumn('last_checked_news', 'last_checked');
    table.dropColumns('last_reviewed_app_id', 'last_checked_reviews');
  })
  .alterTable('watcher', (table) => {
    table.enum('type', ['group', 'news', 'price', 'ugc', 'workshop'])
      .alter();
  });
