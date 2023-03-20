import {
  AutocompleteContext,
  CommandContext,
  SlashCommand,
  SlashCreator,
} from 'slash-create';
import {
  AppType,
  db,
  EmbedBuilder,
  env,
  SteamAPI,
  SteamUtil,
  WatcherType,
} from '@steamwatch/shared';
import CommonCommandOptions from '../../CommonCommandOptions';

interface CommandArguments {
  app: string;
}

export default class NewsCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'news',
      description: 'Fetch the latest news article for the specified app.',
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
      options: [
        CommonCommandOptions.App,
      ],
    });

    this.filePath = __filename;
  }

  // eslint-disable-next-line class-methods-use-this
  override async autocomplete(ctx: AutocompleteContext) {
    const value = ctx.options[ctx.focused];

    return ctx.sendResults(await SteamUtil.createAppAutocomplete(value));
  }

  // eslint-disable-next-line class-methods-use-this
  override async run(ctx: CommandContext) {
    await ctx.defer();
    const { app: query } = ctx.options as CommandArguments;
    const { id } = await SteamUtil.findStoreItem(query);

    if (!id) {
      return ctx.error(`Unable to find an application id for: ${query}`);
    }

    const app = (await db.select('*')
      .from('app')
      .where('id', id)
      .first()) || (await SteamUtil.persistApp(id));

    if (!app) {
      return ctx.error(`Unable to find an application with the id/name: ${query}`);
    }

    if (!SteamUtil.canHaveWatcher(app.type.toLowerCase() as AppType, WatcherType.News)) {
      return ctx.error(`Unable to fetch news for apps of type **${app.type}**!`);
    }

    const news = await SteamAPI.getAppNews(id);

    if (!news) {
      return ctx.embed(EmbedBuilder.createApp(app, {
        description: 'No news found!',
        timestamp: new Date(),
        title: app.name,
        url: SteamUtil.URLS.AppNews(app.id),
      }));
    }

    return ctx.embed(await EmbedBuilder.createNews(app, news));
  }
}
