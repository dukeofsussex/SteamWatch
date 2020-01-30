import { GuildMember } from 'discord.js';
import db from '../db';

export default async function guildMemberRemove(member: GuildMember) {
  const mentions = await db.select('app_watcher_mention.id')
    .from('app_watcher_mention')
    .innerJoin('app_watcher', 'app_watcher.id', 'app_watcher_mention.watcher_id')
    .where({
      entityId: member.id,
      guildId: member.guild.id,
      type: 'user',
    });

  if (!mentions) {
    return;
  }

  await db.delete()
    .from('app_watcher_mention')
    .whereIn('id', mentions.map((mention) => mention.id));
}
