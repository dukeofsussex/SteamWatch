import {
  CommandContext,
  CommandOptionType,
  SlashCommand,
  SlashCreator,
} from 'slash-create';
import db from '../../../db';
import SteamUtil from '../../../steam/SteamUtil';
import { EMBED_COLOURS } from '../../../utils/constants';
import env from '../../../utils/env';

interface CommandArguments {
  query: string;
}

export default class NewsCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'news',
      description: 'Fetch the latest cached news article for the specified app.',
      guildIDs: env.dev ? [env.devGuildId] : undefined,
      options: [{
        type: CommandOptionType.STRING,
        name: 'query',
        description: 'Search term or app id',
        required: true,
      }],
    });

    this.filePath = __filename;
  }

  // eslint-disable-next-line class-methods-use-this
  async run(ctx: CommandContext) {
    await ctx.defer();
    const { query } = ctx.options as CommandArguments;

    const appId = await SteamUtil.findAppId(query);

    if (!appId) {
      return ctx.error(`Unable to find an application with the id/name: ${query}`);
    }

    const news = await db.select(
      'app.id',
      'name',
      'icon',
      'title',
      'markdown',
      'thumbnail',
      'url',
      'created_at',
    ).from('app_news')
      .innerJoin('app', 'app.id', 'app_news.app_id')
      .where('app.id', appId)
      .orderBy('created_at', 'desc')
      .first();

    if (!news) {
      return ctx.embed({
        color: EMBED_COLOURS.DEFAULT,
        description: 'No cached news found!',
      });
    }

    return ctx.embed({
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
          url: SteamUtil.URLS.NewsImage(news.thumbnail),
        }
        : undefined,
      thumbnail: {
        url: SteamUtil.URLS.Icon(news.id, news.icon),
      },
    });
  }
}
