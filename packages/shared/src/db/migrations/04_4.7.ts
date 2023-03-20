// eslint-disable-next-line import/no-import-module-exports
import type { Knex } from 'knex';

exports.up = (knex: Knex) => knex.schema
  .createTable('bundle', (table) => {
    table.integer('id')
      .unsigned()
      .primary();
    table.string('name', 256)
      .notNullable();
  })
  .createTable('sub', (table) => {
    table.integer('id')
      .unsigned()
      .primary();
    table.string('name', 256)
      .notNullable();
  })
  .alterTable('app_price', (table) => {
    table.integer('app_id')
      .unsigned()
      .alter();
    table.integer('bundle_id')
      .unsigned()
      .after('app_id');
    table.integer('sub_id')
      .unsigned()
      .after('bundle_id');
    table.dateTime('last_checked')
      .notNullable()
      .alter();
    table.dateTime('last_update')
      .notNullable()
      .after('last_checked');
    table.foreign('bundle_id')
      .references('id')
      .inTable('bundle')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table.foreign('sub_id')
      .references('id')
      .inTable('sub')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  })
  .alterTable('watcher', (table) => {
    table.integer('bundle_id')
      .unsigned()
      .after('app_id');
    table.integer('sub_id')
      .unsigned()
      .after('group_id');
    table.foreign('bundle_id')
      .references('id')
      .inTable('bundle')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table.foreign('sub_id')
      .references('id')
      .inTable('sub')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  })
  .renameTable('app_price', 'price');

exports.down = (knex: Knex) => knex.schema
  .raw('RENAME TABLE `price` TO `app_price`')
  .raw('DELETE FROM app_price WHERE bundle_id IS NOT NULL OR sub_id IS NOT NULL')
  .alterTable('app_price', (table) => {
    table.dropForeign('bundle_id');
    table.dropForeign('sub_id');
    table.dropColumns('bundle_id', 'sub_id', 'last_update');
    table.integer('app_id')
      .unsigned()
      .notNullable()
      .alter();
    table.dateTime('last_checked')
      .alter();
  })
  .raw('DELETE FROM watcher WHERE bundle_id IS NOT NULL OR sub_id IS NOT NULL')
  .alterTable('watcher', (table) => {
    table.dropForeign('bundle_id');
    table.dropForeign('sub_id');
    table.dropColumns('bundle_id', 'sub_id');
  })
  .dropTable('bundle')
  .dropTable('sub');
