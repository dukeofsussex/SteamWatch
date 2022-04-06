// eslint-disable-next-line import/no-import-module-exports
import { Knex } from 'knex';

exports.up = (knex: Knex) => knex.schema
  .alterTable('app', (table) => {
    table.bigint('latest_ugc')
      .unsigned()
      .after('last_checked_news');
    table.dateTime('last_checked_ugc')
      .after('latest_ugc');
  })
  .raw('ALTER TABLE `watcher` MODIFY COLUMN `type` enum("news", "price", "ugc", "workshop") NOT NULL AFTER `channel_id`');

exports.down = (knex: Knex) => knex.schema
  .alterTable('app', (table) => {
    table.dropColumns('latest_ugc', 'last_checked_ugc');
  })
  .raw('DELETE FROM `watcher` WHERE `type` = "workshop"')
  .raw('ALTER TABLE `watcher` MODIFY COLUMN `type` enum("news", "price", "ugc") NOT NULL AFTER `channel_id`');
