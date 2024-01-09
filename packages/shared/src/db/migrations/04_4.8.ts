// eslint-disable-next-line import/no-import-module-exports
import type { Knex } from 'knex';

exports.up = (knex: Knex) => knex.schema
  .raw('UPDATE currency SET name = "CIS - U.S. Dollar" WHERE code = "CIS-USD"')
  .raw('UPDATE currency SET code = "LATAM-USD", name = "LATAM - U.S. Dollar" WHERE code = "ARS"')
  .raw('UPDATE currency SET code = "MENA-USD", name = "MENA - U.S. Dollar" WHERE code = "TRY"')
  .raw('UPDATE currency SET name = "South Asia - U.S. Dollar" WHERE code = "SASIA-USD"');

exports.down = (knex: Knex) => knex.schema
  .raw('UPDATE currency SET code = "TRY", name = "Turkish Lira" WHERE code = "MENA-USD"')
  .raw('UPDATE currency SET code = "ARS", name = "Argentine Peso" WHERE code = "LATAM-USD"');
