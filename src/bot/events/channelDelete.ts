import { GuildChannel, TextChannel } from 'discord.js';
import { oneLine, stripIndents } from 'common-tags';
import db from '../../db';
import { EMBED_COLOURS } from '../../utils/constants';
import { insertEmoji } from '../../utils/templateTags';

export default async function channelDelete(channel: GuildChannel) {
  if (!(channel instanceof TextChannel)) {
    return;
  }

  const watchers = await db.select('app_id')
    .from('app_watcher')
    .where({
      channelId: channel.id,
      guildId: channel.guild.id,
    });

  if (watchers.length === 0) {
    return;
  }

  channel.guild.owner.sendEmbed({
    color: EMBED_COLOURS.DEFAULT,
    description: stripIndents`
      ${insertEmoji(oneLine)`
        :ALERT: Removed ${watchers.length}
        watcher(s) from **${channel.name}**
        in **${channel.guild.name}**.
      `}
      Reason: Channel deleted.`,
  });

  await db.delete()
    .from('channel')
    .where('id', channel.id);
}
