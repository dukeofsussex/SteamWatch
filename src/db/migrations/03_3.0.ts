// eslint-disable-next-line import/no-import-module-exports
import { Knex } from 'knex';

exports.up = (knex: Knex) => knex.schema
  .createTable('ugc', (table) => {
    table.bigInteger('id').unsigned()
      .primary();
    table.integer('app_id').unsigned()
      .notNullable();
    table.string('name', 256).notNullable();
    table.dateTime('last_update').notNullable();
    table.dateTime('last_checked');
    table.foreign('app_id').references('id')
      .inTable('app')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  })
  .raw('INSERT INTO app_watcher(`app_id`, `channel_id`, `guild_id`, `watch_news`, `watch_price`) SELECT `app_id`, `channel_id`, `guild_id`, 0, `watch_price` FROM `app_watcher` WHERE `watch_news` = 1 AND `watch_price` = 1')
  .raw('UPDATE `app_watcher` SET `watch_price` = 0 WHERE `watch_news` = 1 AND `watch_price` = 1')
  .alterTable('app_watcher', (table) => {
    table.bigInteger('ugc_id').unsigned()
      .after('app_id');
    table.enum('type', ['news', 'price', 'ugc']).notNullable()
      .after('channel_id');
    table.foreign('ugc_id').references('id')
      .inTable('ugc')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  })
  .raw('UPDATE `app_watcher` SET `type` = "price" WHERE `watch_price` = 1')
  .alterTable('app_watcher', (table) => {
    table.dropForeign('guild_id');
    table.dropColumns('guild_id', 'watch_news', 'watch_price');
  })
  .raw('RENAME TABLE `app_watcher` TO `watcher`')
  .raw('RENAME TABLE `app_watcher_mention` TO `watcher_mention`');

exports.down = (knex: Knex) => knex.schema
  .raw('RENAME TABLE `watcher_mention` TO `app_watcher_mention`')
  .raw('RENAME TABLE `watcher` TO `app_watcher`')
  .alterTable('app_watcher', (table) => {
    table.bigInteger('guild_id').unsigned()
      .notNullable();
    table.boolean('watch_news').notNullable();
    table.boolean('watch_price').notNullable();
    table.dropForeign('ugc_id', 'app_watcher_ugc_id_foreign');
    table.dropColumn('ugc_id');
  })
  .raw('UPDATE `app_watcher` SET `watch_price` = 1 WHERE `type` = "price"')
  .raw('UPDATE `app_watcher` SET `watch_news` = 1 WHERE `type` = "news"')
  .raw('UPDATE `app_watcher` SET `guild_id` = (SELECT `guild_id` FROM `channel_webhook` WHERE `id` = `channel_id`)')
  .alterTable('app_watcher', (table) => {
    table.dropColumn('type');
    table.foreign('guild_id').references('id')
      .inTable('guild')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  })
  .dropTable('ugc');
