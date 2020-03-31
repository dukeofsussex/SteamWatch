import { GuildChannel, TextChannel } from 'discord.js';
import db from '../../db';

export default async function channelDelete(channel: GuildChannel) {
  if (!(channel instanceof TextChannel)) {
    return;
  }

  await db.delete()
    .from('channel_webhook')
    .where('id', channel.id);
}
