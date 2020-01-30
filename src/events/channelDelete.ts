import { Channel, TextChannel } from 'discord.js';
import { oneLine } from 'common-tags';
import db from '../db';
import { EMBED_COLOURS } from '../utils/constants';
import { insertEmoji } from '../utils/templateTags';

export default async function channelDelete(channel: Channel) {
  if (!(channel instanceof TextChannel)) {
    return;
  }

  const mentions: any = await db.select('app.name')
    .from('app_watcher')
    .innerJoin('app', 'app.id', 'app_watcher.app_id')
    .where({
      channelId: channel.id,
      guildId: channel.guild.id,
    });

  if (!mentions) {
    return;
  }

  channel.guild.owner.sendEmbed({
    color: EMBED_COLOURS.DEFAULT,
    description: insertEmoji(oneLine)`
      :ALERT: Removed a price watcher for **${mentions.name}**
      in **${channel.guild.name}**.\n
      Reason: Channel deleted`,
  });

  await db.delete()
    .from('app_watcher')
    .where({
      channelId: channel.id,
      guildId: channel.guild.id,
    });
}
