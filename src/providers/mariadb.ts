/* eslint-disable no-underscore-dangle */
/* eslint-disable no-unused-vars */
// @ts-nocheck
import {
  CommandoClient,
  GuildExtension,
  SettingProvider,
} from 'discord.js-commando';
import db from '../db';
import logger from '../logger';

/**
 * Uses a MariaDB/MySQL database to store guild settings.
 * NOTE: Do yourself a favour and don't look too closely.
 * @see {@link https://github.com/discordjs/Commando/blob/master/src/providers/sqlite.js}
 * @extends {SettingProvider}
 */
export default class MariaDBProvider extends SettingProvider {
  // Client that the provider is for.
  private client: CommandoClient;

  // Settings cached in memory, mapped by guild ID (or 'global').
  private prefixes: Map<string, string>;

  // Listeners on the Client, mapped by the event name.
  private listeners: Map<string, any>;

  constructor() {
    super();

    this.prefixes = new Map();
    this.listeners = new Map();
  }

  async init(client: CommandoClient) {
    this.client = client;

    // Load all settings
    const rows = await db.select('id', 'commando_prefix')
      .from('guild');

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const guild = row.id !== '0' ? row.id : 'global';
      this.prefixes.set(guild, row.commandoPrefix);

      if (guild === 'global' || client.guilds.has(row.id)) {
        this.setupGuildPrefix(guild, row.commandoPrefix);
      }
    }

    // Listen for changes
    this.listeners
      .set('commandPrefixChange', (guild: GuildExtension | string, prefix: string) => this.set(guild, 'prefix', prefix))
      .set('guildCreate', (guild: GuildExtension) => {
        if (!this.prefixes.has(guild.id)) {
          return;
        }

        this.setupGuildPrefix(guild.id, this.prefixes.get(guild.id));
      });

    this.listeners.forEach((listener, event) => client.on(event, listener));
  }

  async destroy() {
    // Remove all listeners from the client
    this.listeners.forEach((listener, event) => this.client.removeListener(event, listener));
  }

  get(guild: GuildExtension | string, key: string, defVal: any) {
    if (key !== 'prefix') {
      logger.error(`Unable to process MariaDB.get(${guild}, ${key}, ${defVal})`);
      return defVal;
    }

    const prefix = this.prefixes.get(this.constructor.getGuildID(guild));
    return prefix || defVal;
  }

  async set(guild: GuildExtension | string, key: string, val: any) {
    if (key !== 'prefix') {
      logger.error(`Unable to process MariaDB.set(${guild}, ${key}, ${val})`);
      return val;
    }

    const guildId = this.constructor.getGuildID(guild);
    this.prefixes.set(guildId, val);

    await db('guild').update({ commandoPrefix: val })
      .where('id', (guildId !== 'global' ? guildId : 0));

    return val;
  }

  // eslint-disable-next-line class-methods-use-this
  async remove(guild: GuildExtension | string, key: string) {
    logger.warn(`MariaDB.remove() called for ${guild}`);
    return undefined;
  }

  // eslint-disable-next-line class-methods-use-this
  async clear(guild: GuildExtension | string) {
    logger.warn(`MariaDB.clear() called for ${guild}`);
  }

  private setupGuildPrefix(guild: string, prefix: any) {
    if (typeof guild !== 'string') {
      throw new TypeError('The guild must be a guild ID or "global".');
    }

    if (guild === 'global') {
      this.client._commandPrefix = prefix;
      return;
    }

    const fetchedGuild = this.client.guilds.get(guild) as GuildExtension;

    // eslint-disable-next-line no-param-reassign
    fetchedGuild._commandPrefix = prefix;
  }
}

module.exports = MariaDBProvider;
