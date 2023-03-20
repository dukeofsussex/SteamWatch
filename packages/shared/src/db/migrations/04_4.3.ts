// eslint-disable-next-line import/no-import-module-exports
import type { Knex } from 'knex';

exports.up = (knex: Knex) => knex.schema
  .createTable('app_workshop', (table) => {
    table.increments('id').unsigned();
    table.integer('app_id').unsigned()
      .notNullable();
    table.smallint('filetype')
      .notNullable();
    table.dateTime('last_checked_new');
    table.dateTime('last_checked_update');
    table.foreign('app_id')
      .references('id')
      .inTable('app')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  })
  .raw('INSERT INTO app_workshop (app_id, filetype, last_checked_new) (SELECT id, 0, last_checked_ugc FROM app WHERE last_checked_ugc IS NOT NULL)')
  .alterTable('app', (table) => {
    table.dropColumn('last_checked_ugc');
  })
  .alterTable('group', (table) => {
    table.renameColumn('last_checked', 'last_checked_news');
    table.integer('last_reviewed_app_id')
      .unsigned()
      .after('last_checked');
    table.dateTime('last_checked_reviews')
      .after('last_reviewed_app_id');
    table.foreign('last_reviewed_app_id')
      .references('id')
      .inTable('app')
      .onUpdate('CASCADE')
      .onDelete('SET NULL');
  })
  .alterTable('watcher', (table) => {
    table.enum('type', ['curator', 'group', 'news', 'price', 'ugc', 'workshop_new', 'workshop_update'])
      .notNullable()
      .alter();
    table.integer('workshop_id')
      .unsigned()
      .after('ugc_id');
    table.foreign('workshop_id')
      .references('id')
      .inTable('app_workshop')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  })
  .raw('UPDATE watcher INNER JOIN app_workshop ON app_workshop.app_id = watcher.app_id SET watcher.app_id = NULL, workshop_id = app_workshop.id, type = "workshop_new" WHERE watcher.type = "" AND app_workshop.filetype = 0');

exports.down = (knex: Knex) => knex.schema
  .alterTable('app', (table) => {
    table.dateTime('last_checked_ugc')
      .after('last_checked_news');
  })
  .raw('UPDATE app INNER JOIN app_workshop ON app_workshop.app_id = app.id SET app.last_checked_ugc = app_workshop.last_checked_new WHERE app_workshop.filetype = 0')
  .alterTable('group', (table) => {
    table.dropForeign('last_reviewed_app_id');
    table.dropColumns('last_reviewed_app_id', 'last_checked_reviews');
    table.renameColumn('last_checked_news', 'last_checked');
  })
  .raw('DELETE FROM watcher WHERE type = "curator" OR type = "workshop_update"')
  .raw('UPDATE watcher INNER JOIN app_workshop ON app_workshop.id = watcher.workshop_id SET watcher.app_id = app_workshop.app_id, watcher.workshop_id = NULL WHERE workshop_id IS NOT NULL')
  .alterTable('watcher', (table) => {
    table.dropForeign('workshop_id');
    table.dropColumn('workshop_id');
    table.enum('type', ['group', 'news', 'price', 'ugc', 'workshop'])
      .notNullable()
      .alter();
  })
  .raw('UPDATE watcher SET type = "workshop" WHERE type = ""')
  .dropTable('app_workshop');
