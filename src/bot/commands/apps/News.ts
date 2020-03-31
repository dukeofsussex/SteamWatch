import { CommandMessage } from 'discord.js-commando';
import SteamWatchClient from '../../structures/SteamWatchClient';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import db from '../../../db';
import WebApi from '../../../steam/WebApi';
import { EMBED_COLOURS } from '../../../utils/constants';

export default class NewsCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'news',
      group: 'apps',
      memberName: 'news',
      description: 'Fetch the latest cached news article for the specified app.',
      examples: [
        'news 730',
      ],
      argsPromptLimit: 0,
      args: [
        {
          key: 'appId',
          prompt: 'App identifier',
          type: 'app-id',
        },
      ],
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async run(message: CommandMessage, { appId }: { appId: number }) {
    const news = await db.select(
      'name',
      'icon',
      'app_id',
      'title',
      'markdown',
      'thumbnail',
      'url',
      'created_at',
    ).from('app_news')
      .innerJoin('app', 'app.id', 'app_news.app_id')
      .where('app_id', appId)
      .orderBy('created_at', 'desc')
      .first();

    if (!news) {
      return message.embed({
        color: EMBED_COLOURS.DEFAULT,
        description: 'No cached news found!',
      });
    }

    return message.embed({
      color: EMBED_COLOURS.DEFAULT,
      title: `**${news.title}**`,
      description: news.markdown,
      footer: {
        text: news.name,
      },
      url: news.url,
      timestamp: new Date(),
      image: news.thumbnail
        ? {
          url: WebApi.getNewsImage(news.thumbnail),
        }
        : undefined,
      thumbnail: {
        url: WebApi.getIconUrl(news.id, news.icon),
      },
    });
  }
}
