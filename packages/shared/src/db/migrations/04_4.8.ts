/* eslint-disable import/no-import-module-exports */
import type { Knex } from 'knex';
import { FreeWatcherFlag } from '..';
/* eslint-enable import/no-import-module-exports */

exports.up = (knex: Knex) => knex.schema
  .alterTable('watcher', (table) => {
    table.smallint('free_flag')
      .unsigned()
      .after('thread_id');
  })
  .raw(`UPDATE watcher SET free_flag = ${FreeWatcherFlag.KeepDLC | FreeWatcherFlag.KeepApp | FreeWatcherFlag.Weekend} WHERE type = "free"`)
  .alterTable('app_workshop', (table) => {
    table.enum('type', ['app', 'user'])
      .notNullable()
      .after('last_update');
    table.bigInteger('steam_id')
      .after('app_id');
  })
  .raw('RENAME TABLE `app_workshop` TO `workshop`')
  .raw('UPDATE workshop SET type = "app"')
  .raw('UPDATE currency SET name = "CIS - U.S. Dollar" WHERE code = "CIS-USD"')
  .raw('UPDATE currency SET code = "LATAM-USD", name = "LATAM - U.S. Dollar" WHERE code = "ARS"')
  .raw('UPDATE currency SET code = "MENA-USD", name = "MENA - U.S. Dollar" WHERE code = "TRY"')
  .raw('UPDATE currency SET name = "South Asia - U.S. Dollar" WHERE code = "SASIA-USD"');

exports.down = (knex: Knex) => knex.schema
  .raw('UPDATE currency SET code = "TRY", name = "Turkish Lira" WHERE code = "MENA-USD"')
  .raw('UPDATE currency SET code = "ARS", name = "Argentine Peso" WHERE code = "LATAM-USD"')
  .raw('DELETE FROM workshop WHERE type = "user"')
  .raw('RENAME TABLE `workshop` TO `app_workshop`')
  .alterTable('app_workshop', (table) => {
    table.dropColumn('steam_id');
    table.dropColumn('type');
  })
  .alterTable('watcher', (table) => {
    table.dropColumn('free_flag');
  });
