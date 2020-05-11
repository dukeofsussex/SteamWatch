/* eslint-disable no-underscore-dangle */
import { CommandoGuild, SettingProvider } from 'discord.js-commando';
import SteamWatchClient from '../../structures/SteamWatchClient';
import db from '../../../db';
import logger from '../../../logger';

/**
 * Uses a MariaDB/MySQL database to store guild settings.
 * NOTE: Do yourself a favour and don't look too closely.
 * @see {@link https://github.com/discordjs/Commando/blob/master/src/providers/sqlite.js}
 * @extends {SettingProvider}
 */
export default class MariaDBProvider extends SettingProvider {
  // Client that the provider is for.
  private client!: SteamWatchClient;

  // Settings cached in memory, mapped by guild ID (or 'global').
  private prefixes: Map<string, string>;

  // Listeners on the Client, mapped by the event name.
  private listeners: Map<string, (...args: any[]) => void>;

  constructor() {
    super();

    this.prefixes = new Map();
    this.listeners = new Map();
  }

  async init(client: SteamWatchClient) {
    this.client = client;

    // Load all settings
    const rows = await db.select('id', 'commando_prefix')
      .from('guild');

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const guild = row.id !== '0' ? row.id : 'global';
      this.prefixes.set(guild, row.commandoPrefix);

      if (guild === 'global' || client.guilds.cache.has(row.id)) {
        this.setupGuildPrefix(guild, row.commandoPrefix);
      }
    }

    // Listen for changes
    this.listeners
      .set('commandPrefixChange', (guild: CommandoGuild | string, prefix: string) => this.set(guild, 'prefix', prefix))
      .set('guildCreate', (guild: CommandoGuild) => {
        if (!this.prefixes.has(guild.id)) {
          return;
        }

        this.setupGuildPrefix(guild.id, this.prefixes.get(guild.id)!);
      });

    this.listeners.forEach((listener, event) => client.on(event, listener));
  }

  async destroy() {
    // Remove all listeners from the client
    this.listeners.forEach((listener, event) => this.client.removeListener(event, listener));
  }

  get(guild: CommandoGuild | string, key: string, defVal: any) {
    if (key !== 'prefix') {
      logger.error({
        group: 'Provider',
        message: `Unable to process MariaDB.get(${guild}, ${key}, ${defVal})`,
      });

      return defVal;
    }

    return this.prefixes.get(MariaDBProvider.getGuildID(guild)) || defVal;
  }

  async set(guild: CommandoGuild | string, key: string, val: any) {
    if (key !== 'prefix') {
      logger.error({
        group: 'Provider',
        message: `Unable to process MariaDB.set(${guild}, ${key}, ${val})`,
      });

      return val;
    }

    const guildId = MariaDBProvider.getGuildID(guild);
    this.prefixes.set(guildId, val);

    await db('guild').update({ commandoPrefix: val })
      .where('id', (guildId !== 'global' ? guildId : 0));

    return val;
  }

  // eslint-disable-next-line class-methods-use-this
  async remove(guild: CommandoGuild | string, key: string) {
    logger.warn({
      group: 'Provider',
      message: `MariaDB.remove() called for ${guild} ${key}`,
    });

    return undefined;
  }

  // eslint-disable-next-line class-methods-use-this
  async clear(guild: CommandoGuild | string) {
    logger.warn({
      group: 'Provider',
      message: `MariaDB.clear() called for ${guild}`,
    });
  }

  private setupGuildPrefix(guild: string, prefix: string) {
    if (typeof guild !== 'string') {
      throw new TypeError('The guild must be a guild ID or "global".');
    }

    if (guild === 'global') {
      // @ts-ignore Bad
      this.client._commandPrefix = prefix;
      return;
    }

    const fetchedGuild = this.client.guilds.cache.get(guild)!;
    // @ts-ignore Bad
    fetchedGuild._commandPrefix = prefix;
  }
}
