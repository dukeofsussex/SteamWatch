// eslint-disable-next-line import/no-import-module-exports
import { Knex } from 'knex';

exports.up = (knex: Knex) => knex.schema
  .alterTable('app', (table) => {
    table.bigint('latest_news')
      .unsigned()
      .after('type');
  })
  .raw('UPDATE `app` INNER JOIN `app_news` an ON `app`.`id` = `an`.`app_id` SET `latest_news` = `gid`')
  .dropTable('app_news');

exports.down = (knex: Knex) => knex.schema
  .alterTable('app', (table) => {
    table.dropColumn('latest_news');
  })
  .createTable('app_news', (table) => {
    table.increments('id').unsigned();
    table.integer('app_id').unsigned()
      .notNullable();
    table.bigInteger('gid').unsigned();
    table.string('title', 128).notNullable();
    table.string('markdown', 2048).notNullable();
    table.string('thumbnail', 256);
    table.string('url', 256).notNullable();
    table.dateTime('created_at').notNullable();
    table.foreign('app_id').references('id')
      .inTable('app')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
