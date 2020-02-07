import { Role } from 'discord.js';
import db from '../db';

export default async function roleDelete(role: Role) {
  const mentions = await db.select('app_watcher_mention.id')
    .from('app_watcher_mention')
    .innerJoin('app_watcher', 'app_watcher.id', 'app_watcher_mention.watcher_id')
    .where({
      entityId: role.id,
      guildId: role.guild.id,
      type: 'role',
    });

  if (mentions.length === 0) {
    return;
  }

  await db.delete()
    .from('app_watcher_mention')
    .whereIn('id', mentions.map((mention) => mention.id));
}
