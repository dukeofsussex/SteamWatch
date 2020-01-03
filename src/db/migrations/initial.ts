// eslint-disable-next-line no-unused-vars
import Knex from 'knex';

exports.up = (knex: Knex) => knex.schema.createTable('app', (table) => {
  table.integer('id').unsigned().primary().notNullable();
  table.bigInteger('article_id').unsigned().notNullable();
  table.string('url', 255).notNullable();
  table.dateTime('created_at').notNullable();
}).createTable('app_watcher', (table) => {
  table.increments('id');
  table.integer('app_id').unsigned().notNullable();
  table.bigInteger('guild_id').unsigned().notNullable();
  table.bigInteger('channel_id').unsigned().notNullable();
  table.foreign('app_id').references('id').inTable('app');
}).createTable('commando', (table) => {
  table.bigInteger('guild_id').unsigned().primary().notNullable();
  table.text('settings');
});

exports.down = (knex: Knex) => knex.schema
  .dropTable('app')
  .dropTable('app_watcher')
  .dropTable('commando');
