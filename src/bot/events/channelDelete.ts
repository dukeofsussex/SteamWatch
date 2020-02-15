import { GuildChannel, TextChannel } from 'discord.js';
import { oneLine } from 'common-tags';
import db from '../../db';
import { EMBED_COLOURS } from '../../utils/constants';
import { insertEmoji } from '../../utils/templateTags';

export default async function channelDelete(channel: GuildChannel) {
  if (!(channel instanceof TextChannel)) {
    return;
  }

  const mentions = await db.select('app_id')
    .from('app_watcher')
    .where({
      channelId: channel.id,
      guildId: channel.guild.id,
    });

  if (mentions.length === 0) {
    return;
  }

  channel.guild.owner.sendEmbed({
    color: EMBED_COLOURS.DEFAULT,
    description: insertEmoji(oneLine)`
      :ALERT: Removed ${mentions.length}
      price watcher(s) from **${channel.name}**
      in **${channel.guild.name}**.\n
      Reason: Channel deleted.`,
  });

  await db.delete()
    .from('app_watcher')
    .where({
      channelId: channel.id,
      guildId: channel.guild.id,
    });
}
