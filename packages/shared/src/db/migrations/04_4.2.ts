// eslint-disable-next-line import/no-import-module-exports
import type { Knex } from 'knex';

exports.up = (knex: Knex) => knex.schema
  .createTable('group', (table) => {
    table.integer('id')
      .unsigned()
      .primary();
    table.string('name', 64)
      .notNullable();
    table.string('avatar', 42)
      .notNullable();
    table.string('vanity_url', 32)
      .notNullable();
    table.dateTime('last_checked');
  })
  .alterTable('watcher', (table) => {
    table.enum('type', ['group', 'news', 'price', 'ugc', 'workshop'])
      .notNullable()
      .alter();
    table.integer('group_id')
      .unsigned()
      .after('app_id');
    table.foreign('group_id')
      .references('id')
      .inTable('group')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });

exports.down = (knex: Knex) => knex.schema
  .raw('DELETE FROM watcher WHERE type = "group"')
  .alterTable('watcher', (table) => {
    table.dropForeign('group_id');
    table.dropColumn('group_id');
    table.enum('type', ['news', 'price', 'ugc', 'workshop'])
      .notNullable()
      .alter();
  })
  .dropTable('group');
