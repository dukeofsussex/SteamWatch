import { Guild } from 'discord.js';
import db from '../db';

export default async function guildUpdate(guild: Guild) {
  await db('guild')
    .update({
      name: guild.name,
      region: guild.region,
      memberCount: guild.memberCount,
    })
    .where('id', guild.id);
}
