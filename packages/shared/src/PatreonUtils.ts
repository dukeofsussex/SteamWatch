import db from './db';
import env from './env';

const WATCHERS_PER_TIER = [0, 50, 100, 200];

export default class PatreonUtils {
  static getExtraWatchers(pledgeTiers: number[]) {
    return pledgeTiers.reduce((total, tier) => (total + WATCHERS_PER_TIER[tier - 1]!), 0);
  }

  static async setWatcherStates(guildId: string) {
    const patrons = await db.select('pledgeTier')
      .from('patron')
      .where('guildId', guildId);
    const maxWatchers = env.settings.maxWatchersPerGuild
      + this.getExtraWatchers(patrons.map((patron) => patron.pledgeTier));

    const baseQuery = db('watcher')
      .whereIn('channelId', (builder) => builder.select('id')
        .from('channel_webhook')
        .where('guildId', guildId))
      .orderBy('id', 'asc');

    await baseQuery.clone()
      .update('inactive', true);

    await baseQuery.clone()
      .update('inactive', false)
      .limit(maxWatchers);
  }
}
