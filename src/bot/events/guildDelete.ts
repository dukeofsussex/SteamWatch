import { Guild } from 'discord.js';
import db from '../../db';
import logger from '../../logger';

export default async function guildDelete(guild: Guild) {
  await db.delete()
    .from('guild')
    .where('id', guild.id);

  logger.info({
    group: 'Bot',
    message: `Left guild ${guild.name} (${guild.memberCount} members)`,
  });
}
