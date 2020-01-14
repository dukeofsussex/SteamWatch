/* eslint-disable no-continue */
/* eslint-disable no-param-reassign */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-unused-vars */
// @ts-nocheck
import {
  CommandoClient,
  Command,
  CommandGroup,
  GuildExtension,
  SettingProvider,
} from 'discord.js-commando';
import db from '../db';
import logger from '../logger';

import Knex = require('knex');


/**
 * Uses a MariaDB/MySQL database to store guild settings.
 * NOTE: Do yourself a favour and don't look too closely.
 * @see {@link https://github.com/discordjs/Commando/blob/master/src/providers/sqlite.js}
 * @extends {SettingProvider}
 */
export default class MariaDBProvider extends SettingProvider {
  // Client that the provider is for.
  private client: CommandoClient;

  // Query builder that will be used for storing/retrieving settings.
  private db: Knex;

  // Settings cached in memory, mapped by guild ID (or 'global').
  private settings: Map<string, object>;

  // Listeners on the Client, mapped by the event name.
  private listeners: Map<string, any>;

  constructor() {
    super();

    this.db = db;

    Object.defineProperty(this, 'client', { value: null, writable: true });

    this.settings = new Map();
    this.listeners = new Map();
  }

  async init(client: CommandoClient) {
    this.client = client;

    // Load all settings
    const rows = await this.db.select(db.raw('CAST(guild_id AS CHAR) AS guild_id'), 'settings')
      .from('commando');

    for (const row of rows) {
      let settings;

      try {
        settings = JSON.parse(row.settings);
      } catch (err) {
        logger.warn(`MariaDBProvider couldn't parse the settings stored for guild ${row.guildId}.`);
        continue;
      }

      const guild = row.guildId !== '0' ? row.guildId : 'global';
      this.settings.set(guild, settings);

      if (guild === 'global' || client.guilds.has(row.guildId)) {
        this.setupGuild(guild, settings);
      }
    }

    // Listen for changes
    this.listeners
      .set('commandPrefixChange', (guild: GuildExtension | string, prefix: string) => this.set(guild, 'prefix', prefix))
      .set('commandStatusChange', (guild: GuildExtension | string, command: Command, enabled: boolean) => this.set(guild, `cmd-${command.name}`, enabled))
      .set('groupStatusChange', (guild: GuildExtension | string, group: CommandGroup, enabled: boolean) => this.set(guild, `grp-${group.id}`, enabled))
      .set('guildCreate', (guild: GuildExtension) => {
        const settings = this.settings.get(guild.id);
        if (!settings) return;
        this.setupGuild(guild.id, settings);
      })
      .set('commandRegister', (command: Command) => {
        for (const [guild, settings] of this.settings) {
          if (guild !== 'global' && !client.guilds.has(guild)) {
            continue;
          }
          MariaDBProvider.setupGuildCommand(client.guilds.get(guild), command, settings);
        }
      })
      .set('groupRegister', (group: CommandGroup) => {
        for (const [guild, settings] of this.settings) {
          if (guild !== 'global' && !client.guilds.has(guild)) {
            continue;
          }
          MariaDBProvider.setupGuildGroup(client.guilds.get(guild), group, settings);
        }
      });
    for (const [event, listener] of this.listeners) client.on(event, listener);
  }

  async destroy() {
    // Remove all listeners from the client
    for (const [event, listener] of this.listeners) {
      this.client.removeListener(event, listener);
    }
    this.listeners.clear();
  }

  get(guild: GuildExtension | string, key: string, defVal: any) {
    const settings: any = this.settings.get(this.constructor.getGuildID(guild));
    return !settings || settings[key] === 'undefined' ? defVal : settings[key];
  }

  async set(guild: GuildExtension | string, key: string, val: any) {
    const guildId = this.constructor.getGuildID(guild);
    let settings: any = this.settings.get(guildId);
    if (!settings) {
      settings = {};
      this.settings.set(guildId, settings);
    }

    settings[key] = val;

    await this.db.raw('INSERT INTO commando (guild_id, settings) values (?, ?) ON DUPLICATE KEY UPDATE settings=?',
      [
        (guildId !== 'global' ? guildId : 0),
        JSON.stringify(settings),
        JSON.stringify(settings),
      ]);

    if (guild === 'global') this.updateOtherShards(key, val);
    return val;
  }

  async remove(guild: GuildExtension | string, key: string) {
    const guildId = this.constructor.getGuildID(guild);
    const settings: any = this.settings.get(guildId);
    if (!settings || typeof settings[key] === 'undefined') {
      return undefined;
    }

    const val = settings[key];
    settings[key] = undefined;

    await this.db.raw('INSERT INTO commando (guild_id, settings) values (?, ?) ON DUPLICATE KEY UPDATE settings=?',
      [
        (guildId !== 'global' ? guildId : 0),
        JSON.stringify(settings),
        JSON.stringify(settings),
      ]);

    if (guild === 'global') {
      this.updateOtherShards(key, undefined);
    }
    return val;
  }

  async clear(guild: GuildExtension | string) {
    const guildId = this.constructor.getGuildID(guild);
    if (!this.settings.has(guildId)) {
      return;
    }

    this.settings.delete(guildId);

    // TODO Review
    await this.db.delete()
      .from('commando')
      .where('guild_id', guildId !== 'global' ? guildId : 0);
  }

  setupGuild(guild: string, settings: any) {
    if (typeof guild !== 'string') {
      throw new TypeError('The guild must be a guild ID or "global".');
    }

    const fetchedGuild = this.client.guilds.get(guild) as GuildExtension || null;

    // Load the command prefix
    if (typeof settings.prefix !== 'undefined') {
      if (fetchedGuild) {
        fetchedGuild._commandPrefix = settings.prefix;
      } else {
        this.client._commandPrefix = settings.prefix;
      }
    }

    // Load all command/group statuses
    for (const command of this.client.registry.commands.values()) {
      MariaDBProvider.setupGuildCommand(fetchedGuild, command, settings);
    }

    for (const group of this.client.registry.groups.values()) {
      MariaDBProvider.setupGuildGroup(fetchedGuild, group, settings);
    }
  }

  // Sets up a command's status in a guild from the guild's settings
  static setupGuildCommand(guild: GuildExtension | null, command: Command, settings: object) {
    if (typeof settings[`cmd-${command.name}`] === 'undefined') {
      return;
    }

    if (guild) {
      if (!guild._commandsEnabled) {
        guild._commandsEnabled = {};
      }

      guild._commandsEnabled[command.name] = settings[`cmd-${command.name}`];
    } else {
      command._globalEnabled = settings[`cmd-${command.name}`];
    }
  }

  // Sets up a command group's status in a guild from the guild's settings
  static setupGuildGroup(guild: GuildExtension | null, group: CommandGroup, settings: object) {
    if (typeof settings[`grp-${group.id}`] === 'undefined') {
      return;
    }

    if (guild) {
      if (!guild._groupsEnabled) {
        guild._groupsEnabled = {};
      }
      guild._groupsEnabled[group.id] = settings[`grp-${group.id}`];
    } else {
      group._globalEnabled = settings[`grp-${group.id}`];
    }
  }

  private updateOtherShards(key: string, value: any) {
    if (!this.client.shard) {
      return;
    }

    const stringifiedKey = JSON.stringify(key);
    const val = typeof value !== 'undefined' ? JSON.stringify(value) : 'undefined';
    this.client.shard.broadcastEval(`
      if(this.shard.id !== ${this.client.shard.id} && this.provider && this.provider.settings) {
        let global = this.provider.settings.get('global');
        if(!global) {
          global = {};
          this.provider.settings.set('global', global);
        }
        global[${stringifiedKey}] = ${val};
      }
    `);
  }
}

module.exports = MariaDBProvider;
