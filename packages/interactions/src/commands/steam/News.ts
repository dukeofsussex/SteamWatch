import {
  AutocompleteContext,
  CommandContext,
  CommandOptionType,
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

interface CommandArguments {
  query: string;
}

export default class NewsCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'news',
      description: 'Fetch the latest news article for the specified app.',
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
      options: [{
        type: CommandOptionType.STRING,
        name: 'query',
        description: 'Search term or app id',
        autocomplete: true,
        required: true,
      }],
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
    const { query } = ctx.options as CommandArguments;
    const appId = await SteamUtil.findAppId(query);

    if (!appId) {
      return ctx.error(`Unable to find an application id for: ${query}`);
    }

    const app = (await db.select('*')
      .from('app')
      .where('id', appId)
      .first()) || (await SteamUtil.persistApp(appId));

    if (!app) {
      return ctx.error(`Unable to find an application with the id/name: ${query}`);
    }

    if (!SteamUtil.canHaveWatcher(app.type.toLowerCase() as AppType, WatcherType.NEWS)) {
      return ctx.error(`Unable to fetch news for apps of type **${app.type}**!`);
    }

    const news = await SteamAPI.getAppNews(appId);

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
