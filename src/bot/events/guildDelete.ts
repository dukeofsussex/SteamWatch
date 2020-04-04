import { Guild } from 'discord.js';
import db from '../../db';

export default async function guildDelete(guild: Guild) {
  await db.delete()
    .from('guild')
    .where('id', guild.id);
}
