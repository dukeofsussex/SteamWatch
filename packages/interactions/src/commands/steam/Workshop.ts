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
  EPublishedFileInfoMatchingFileType as EPFIMFileType,
  EPublishedFileQueryType,
  steamClient,
  SteamUtil,
  WatcherType,
} from '@steamwatch/shared';
import CommonCommandOptions from '../../CommonCommandOptions';

interface BaseArguments {
  filetype: EPFIMFileType;
  app: string;
}

interface CommandArguments {
  new: BaseArguments;
  update: BaseArguments;
}

export default class WorkshopCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'workshop',
      description: 'Fetch the latest workshop item for the specified app.',
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
      options: [{
        type: CommandOptionType.SUB_COMMAND,
        name: 'new',
        description: 'Fetch the latest new submission from a Steam app\'s workshop',
        options: [
          CommonCommandOptions.WorkshopFileType,
          CommonCommandOptions.App,
        ],
      }, {
        type: CommandOptionType.SUB_COMMAND,
        name: 'update',
        description: 'Fetch the latest updated submission from a Steam app\'s workshop',
        options: [
          CommonCommandOptions.WorkshopFileType,
          CommonCommandOptions.App,
        ],
      }],
    });

    this.filePath = __filename;
  }

  // eslint-disable-next-line class-methods-use-this
  override async autocomplete(ctx: AutocompleteContext) {
    const value = ctx.options[ctx.subcommands[0]!][ctx.focused];

    return ctx.sendResults(await SteamUtil.createAppAutocomplete(value));
  }

  // eslint-disable-next-line class-methods-use-this
  override async run(ctx: CommandContext) {
    await ctx.defer();

    if (!steamClient.connected) {
      return ctx.error('Currently not connected to Steam. Please try again in a few minutes');
    }

    const options = ctx.options as CommandArguments;
    const { filetype, app: query } = options.new || options.update;

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

    if (!SteamUtil.canHaveWatcher(app.type.toLowerCase() as AppType, WatcherType.WorkshopNew)) {
      return ctx.error(`Unable to fetch workshop items for apps of type **${app.type}**!`);
    }

    const files = await steamClient.queryFiles(
      appId,
      options.new
        ? EPublishedFileQueryType.RankedByPublicationDate
        : EPublishedFileQueryType.RankedByLastUpdatedDate,
      filetype,
    );

    if (!files.publishedfiledetails.length) {
      return ctx.embed(EmbedBuilder.createApp(app, {
        description: 'No UGC found!',
        timestamp: new Date(),
        title: app.name,
        url: SteamUtil.URLS.Workshop(app.id),
      }));
    }

    return ctx.embed(await EmbedBuilder.createWorkshop(app, files.publishedfiledetails[0]!, 'time_updated'));
  }
}
