import Knex = require('knex');

exports.up = (knex: Knex) => knex.schema
  .createTable('currency', (table) => {
    table.increments('id').unsigned();
    table.string('name', 32).notNullable();
    table.string('country_code', 2).notNullable();
    table.string('abbreviation', 16).notNullable();
    table.string('flag', 8).notNullable();
  })
  .createTable('guild', (table) => {
    table.bigInteger('id').unsigned()
      .primary();
    table.string('name', 128).notNullable();
    table.string('region', 16).notNullable();
    table.integer('member_count').unsigned();
    table.integer('currency_id').unsigned()
      .notNullable();
    table.string('commando_prefix', 16);
    table.foreign('currency_id').references('id')
      .inTable('currency');
  })
  .createTable('webhook', (table) => {
    table.bigInteger('id').unsigned()
      .primary();
    table.string('token', 80).notNullable();
  })
  .createTable('app', (table) => {
    table.integer('id').unsigned()
      .primary();
    table.string('name', 256).notNullable();
    table.string('icon', 42).notNullable();
    table.string('type', 32).notNullable();
    table.dateTime('last_checked_news');
  })
  .createTable('app_news', (table) => {
    table.bigInteger('id').unsigned()
      .primary();
    table.integer('app_id').unsigned()
      .notNullable();
    table.string('url', 256).notNullable();
    table.dateTime('created_at').notNullable();
    table.foreign('app_id').references('id')
      .inTable('app')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  })
  .createTable('app_watcher', (table) => {
    table.increments('id').unsigned();
    table.integer('app_id').unsigned()
      .notNullable();
    table.bigInteger('channel_id').unsigned()
      .notNullable();
    table.bigInteger('guild_id').unsigned()
      .notNullable();
    table.boolean('watch_news').notNullable();
    table.boolean('watch_price').notNullable();
    table.foreign('app_id').references('id')
      .inTable('app');
    table.foreign('channel_id').references('id')
      .inTable('webhook')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table.foreign('guild_id').references('id')
      .inTable('guild')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  })
  .createTable('app_watcher_mention', (table) => {
    table.increments('id').unsigned();
    table.integer('watcher_id').unsigned()
      .notNullable();
    table.bigInteger('entity_id').unsigned()
      .notNullable();
    table.enum('type', ['member', 'role']).notNullable();
    table.foreign('watcher_id').references('id')
      .inTable('app_watcher')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  })
  .createTable('app_price', (table) => {
    table.increments('id').unsigned();
    table.integer('app_id').unsigned()
      .notNullable();
    table.integer('currency_id').unsigned()
      .notNullable();
    table.integer('price').unsigned()
      .notNullable();
    table.integer('discounted_price').unsigned()
      .notNullable();
    table.dateTime('last_checked');
    table.foreign('app_id').references('id')
      .inTable('app')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table.foreign('currency_id').references('id')
      .inTable('currency');
  });

exports.down = (knex: Knex) => knex.schema
  .dropTable('app_price')
  .dropTable('app_news')
  .dropTable('app_watcher_mention')
  .dropTable('app_watcher')
  .dropTable('app')
  .dropTable('webhook')
  .dropTable('guild')
  .dropTable('currency');
