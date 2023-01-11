// eslint-disable-next-line import/no-import-module-exports
import type { Knex } from 'knex';

exports.up = (knex: Knex) => knex.schema
  .alterTable('guild', (table) => {
    table.string('custom_webhook_name', 32)
      .after('currency_id');
    table.string('custom_webhook_avatar', 128)
      .after('custom_webhook_name');
  })
  .alterTable('watcher', (table) => {
    table.boolean('inactive')
      .notNullable()
      .after('type');
  })
  .createTable('patron', (table) => {
    table.integer('id')
      .primary();
    table.bigInteger('discord_id')
      .unsigned();
    table.string('email')
      .notNullable();
    table.integer('pledge_amount_cents')
      .notNullable();
    table.integer('pledge_tier')
      .notNullable();
    table.bigInteger('guild_id')
      .unsigned();
    table.foreign('guild_id')
      .references('id')
      .inTable('guild')
      .onDelete('SET NULL');
  });

exports.down = (knex: Knex) => knex.schema
  .alterTable('guild', (table) => {
    table.dropColumns('custom_webhook_name', 'custom_webhook_avatar');
  })
  .alterTable('watcher', (table) => {
    table.dropColumn('inactive');
  })
  .dropTable('patron');
