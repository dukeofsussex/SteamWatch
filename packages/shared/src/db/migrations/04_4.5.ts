// eslint-disable-next-line import/no-import-module-exports
import type { Knex } from 'knex';

exports.up = (knex: Knex) => knex.schema
  .createTable('free_package', (table) => {
    table.integer('id')
      .unsigned()
      .primary();
    table.integer('app_id')
      .unsigned();
    table.enum('type', ['promo', 'weekend']);
    table.dateTime('start_time');
    table.dateTime('end_time');
    table.boolean('active')
      .notNullable();
    table.dateTime('last_checked')
      .notNullable();
    table.dateTime('last_update')
      .notNullable();
    table.foreign('app_id')
      .references('id')
      .inTable('app')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  })
  .raw('UPDATE app SET type = LOWER(type)')
  .alterTable('app', (table) => {
    table.enum('type', ['application', 'config', 'dlc', 'game', 'hardware', 'music', 'video'])
      .alter();
  })
  .alterTable('watcher', (table) => {
    table.enum('type', ['curator', 'free', 'forum', 'group', 'news', 'price', 'ugc', 'workshop_new', 'workshop_update'])
      .notNullable()
      .alter();
  });

exports.down = (knex: Knex) => knex.schema
  .alterTable('app', (table) => {
    table.string('type', 32)
      .notNullable()
      .alter();
  })
  .raw('UPDATE app SET type = CONCAT(UCASE(LEFT(type, 1)),SUBSTRING(type, 2))')
  .raw('DELETE FROM watcher WHERE type = "free"')
  .alterTable('watcher', (table) => {
    table.enum('type', ['curator', 'forum', 'group', 'news', 'price', 'ugc', 'workshop_new', 'workshop_update'])
      .notNullable()
      .alter();
  })
  .dropTable('free_package');
