// eslint-disable-next-line no-unused-vars
import Knex = require('knex');

exports.up = (knex: Knex) => knex.schema.createTable('app', (table) => {
  table.integer('id').unsigned()
    .primary();
  table.string('name', 256);
  table.string('type', 32);
  table.dateTime('last_checked');
})
  .createTable('app_news', (table) => {
    table.bigInteger('id').unsigned()
      .primary();
    table.integer('app_id').unsigned();
    table.string('url', 256);
    table.dateTime('created_at');
    table.foreign('app_id').references('id')
      .inTable('app');
  })
  .createTable('app_watcher', (table) => {
    table.increments('id');
    table.integer('app_id').unsigned();
    table.bigInteger('guild_id').unsigned();
    table.bigInteger('channel_id').unsigned();
    table.foreign('app_id').references('id')
      .inTable('app');
  })
  .createTable('app_watcher_mention', (table) => {
    table.increments('id');
    table.integer('watcher_id').unsigned();
    table.bigInteger('entity_id').unsigned();
    table.enum('type', ['role', 'user']);
    table.foreign('watcher_id').references('id')
      .inTable('app_watcher');
  })
  .createTable('commando', (table) => {
    table.bigInteger('guild_id').unsigned()
      .primary();
    table.text('settings');
  });

exports.down = (knex: Knex) => knex.schema
  .dropTable('app_news')
  .dropTable('app_watcher_mention')
  .dropTable('app_watcher')
  .dropTable('app')
  .dropTable('commando');
