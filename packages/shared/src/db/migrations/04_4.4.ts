// eslint-disable-next-line import/no-import-module-exports
import type { Knex } from 'knex';

exports.up = (knex: Knex) => knex.schema
  .createTable('forum', (table) => {
    table.bigInteger('id')
      .unsigned()
      .primary();
    table.integer('app_id')
      .unsigned();
    table.integer('group_id')
      .unsigned();
    table.bigInteger('subforum_id')
      .unsigned()
      .notNullable();
    table.string('name', 32)
      .notNullable();
    table.enum('type', ['event', 'general', 'publishedfile', 'trading', 'workshop'])
      .notNullable();
    table.dateTime('last_checked');
    table.foreign('app_id')
      .references('id')
      .inTable('app')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table.foreign('group_id')
      .references('id')
      .inTable('group')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  })
  .alterTable('app', (table) => {
    table.integer('ogg_id')
      .unsigned()
      .after('id');
  })
  .alterTable('watcher', (table) => {
    table.enum('type', ['curator', 'forum', 'group', 'news', 'price', 'ugc', 'workshop_new', 'workshop_update'])
      .notNullable()
      .alter();
    table.bigInteger('forum_id')
      .unsigned()
      .after('app_id');
    table.foreign('forum_id')
      .references('id')
      .inTable('forum')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });

exports.down = (knex: Knex) => knex.schema
  .raw('DELETE FROM watcher WHERE type = "forum"')
  .alterTable('app', (table) => {
    table.dropColumn('ogg_id');
  })
  .alterTable('watcher', (table) => {
    table.dropForeign('forum_id');
    table.dropColumn('forum_id');
    table.enum('type', ['curator', 'group', 'news', 'price', 'ugc', 'workshop_new', 'workshop_update'])
      .notNullable()
      .alter();
  })
  .dropTable('forum');
