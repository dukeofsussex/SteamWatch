// eslint-disable-next-line import/no-import-module-exports
import { Knex } from 'knex';

exports.up = (knex: Knex) => knex.schema
  .alterTable('currency', (table) => {
    table.string('abbreviation', 16).after('name')
      .alter({});
    table.renameColumn('abbreviation', 'code');
    table.dropColumn('flag');
  })
  .alterTable('guild', (table) => {
    table.dropColumns('region', 'member_count', 'commando_prefix');
    table.dateTime('last_update').defaultTo(knex.fn.now())
      .notNullable();
  })
  .raw('DELETE FROM `app_news` WHERE (`id`, `app_id`) NOT IN (SELECT `id`, `app_id` FROM `app_news` AS `a` WHERE `created_at` = (SELECT MAX(`created_at`) FROM `app_news` AS `b` WHERE `a`.`app_id` = `b`.`app_id`))')
  .alterTable('app_news', (table) => {
    table.renameColumn('id', 'gid');
    table.dropPrimary();
  })
  .alterTable('app_news', (table) => {
    table.bigInteger('gid').unsigned()
      .after('app_id')
      .alter({});
  })
  .raw('ALTER TABLE `app_news` ADD COLUMN `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST')
  .alterTable('app_news', (table) => {
    table.integer('app_id').unsigned()
      .notNullable()
      .unique()
      .alter({});
  })
  .alterTable('app_price', (table) => {
    table.dropColumns('formatted_price', 'formatted_discounted_price');
  });

exports.down = (knex: Knex) => knex.schema
  .alterTable('currency', (table) => {
    table.string('code', 16).after('country_code')
      .alter({});
    table.renameColumn('code', 'abbreviation');
    table.string('flag', 8).notNullable();
  })
  .alterTable('guild', (table) => {
    table.string('region', 16).notNullable()
      .after('name');
    table.integer('member_count').unsigned()
      .notNullable()
      .after('region');
    table.string('commando_prefix', 16)
      .after('currency_id');
    table.dropColumn('last_update');
  })
  .alterTable('app_news', (table) => {
    table.dropColumn('id');
    table.dropUnique(['app_id']);
    table.renameColumn('gid', 'id');
  })
  .alterTable('app_news', (table) => {
    table.bigInteger('id').unsigned()
      .first()
      .alter({});
    table.primary(['id', 'app_id']);
  })
  .alterTable('app_price', (table) => {
    table.string('formatted_price', 32).notNullable()
      .after('price');
    table.string('formatted_discounted_price', 32).notNullable()
      .after('discounted_price');
  });
