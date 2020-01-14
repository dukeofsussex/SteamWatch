// eslint-disable-next-line no-unused-vars
import { CommandoClient } from 'discord.js-commando';
// eslint-disable-next-line no-unused-vars
import { TextChannel } from 'discord.js';
import WebApi from '../../steam/web-api';
import db from '../../db';

async function processNews(client: CommandoClient, newsItem: {id: number, articleId: string}) {
  const news = await WebApi.getAppNewsAsync(newsItem.id);

  if (!news || news.gid === newsItem.articleId) {
    return;
  }

  const guildChannels = await db.select('guild_id', 'channel_id')
    .from('app_watchers')
    .where('app_id', newsItem.id);

  for (let i = 0; i < guildChannels.length; i += 1) {
    const element = guildChannels[i];
    const guild = client.guilds.get(element.guildId);

    if (guild) {
      const channel = guild.channels.get(element.channelId) as TextChannel;

      if (channel) {
        channel.send(news.url);
      }
    }
  }

  await db('app').update({ last_checked: new Date().toISOString() })
    .where('id', newsItem.id);

  await db('app_news').insert({
    id: news.appid,
    app_id: news.appid,
    url: news.url,
    created_at: new Date(news.date).toISOString(),
  });
}

export default processNews;
