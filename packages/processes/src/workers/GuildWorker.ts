import { RESTAPIPartialCurrentUserGuild, RESTGetAPICurrentUserGuildsResult, Routes } from 'discord-api-types/v9';
import { db, DiscordAPI, logger } from '@steamwatch/shared';
import Worker from './Worker';

export default class GuildWorker extends Worker {
  constructor() {
    super(900000); // 15m
  }

  async work() {
    try {
      await GuildWorker.processGuilds();
    } catch (err) {
      logger.error({
        message: 'Unable to process guilds',
        err,
      });
      this.wait();
      return;
    }

    const count = await db.delete()
      .from('guild')
      .whereRaw('last_update <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)');

    if (count > 0) {
      logger.info({
        message: 'Left guild(s)',
        count,
      });
    }

    this.wait();
  }

  static async processGuilds(after?: string) {
    const guilds = await DiscordAPI.get(Routes.userGuilds(), {
      query: new URLSearchParams(after ? [['after', after]] : undefined),
    }) as RESTGetAPICurrentUserGuildsResult;

    // TODO Set up guilds that haven't been set up by users
    for (let i = 0; i < guilds.length; i += 1) {
      const guild = guilds[i] as RESTAPIPartialCurrentUserGuild;

      // eslint-disable-next-line no-await-in-loop
      await db('guild').update({
        name: guild.name,
        lastUpdate: new Date(),
      })
        .where('id', guild.id);
    }

    if (guilds.length >= 200) {
      await this.processGuilds(guilds[guilds.length - 1]!.id);
    }
  }
}
