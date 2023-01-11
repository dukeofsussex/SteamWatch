// eslint-disable-next-line import/no-import-module-exports
import type { Knex } from 'knex';

exports.up = (knex: Knex) => knex.schema
  .alterTable('app', (table) => {
    table.dropColumn('latest_news');
    table.dropColumn('latest_ugc');
  })
  .alterTable('watcher', (table) => {
    table.bigInteger('thread_id')
      .unsigned()
      .after('channel_id');
  })
  .alterTable('ugc', (table) => {
    table.dropColumn('last_update');
  });

exports.down = (knex: Knex) => knex.schema
  .alterTable('app', (table) => {
    table.bigint('latest_news')
      .unsigned()
      .after('type');
    table.bigint('latest_ugc')
      .unsigned()
      .after('last_checked_news');
  })
  .alterTable('watcher', (table) => {
    table.dropColumn('thread_id');
  })
  .alterTable('ugc', (table) => {
    table.dateTime('last_update')
      .after('name');
  });
