import { RESTGetAPICurrentUserGuildsResult, Routes } from 'discord-api-types/v9';
import Worker from './Worker';
import db from '../db';
import DiscordAPI from '../utils/DiscordAPI';
import logger from '../utils/logger';

export default class GuildWorker extends Worker {
  constructor() {
    super(900000); // 15m
  }

  async work() {
    await GuildWorker.processGuilds();

    const count = await db.delete()
      .from('guild')
      .whereRaw('last_update <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR)');

    if (count > 0) {
      logger.info({
        group: 'Worker',
        message: `Left ${count} guild(s)`,
      });
    }

    this.wait();
  }

  static async processGuilds(after?: string) {
    const guilds = await DiscordAPI.get(Routes.userGuilds(), {
      query: new URLSearchParams(after ? [['after', after]] : undefined),
    }) as RESTGetAPICurrentUserGuildsResult;

    for (let i = 0; i < guilds.length; i += 1) {
      const guild = guilds[i];

      // eslint-disable-next-line no-await-in-loop
      await db('guild').update({
        name: guild.name,
        lastUpdate: new Date(),
      })
        .where('id', guild.id);
    }

    if (guilds.length >= 200) {
      await this.processGuilds(guilds[guilds.length - 1].id);
    }
  }
}
