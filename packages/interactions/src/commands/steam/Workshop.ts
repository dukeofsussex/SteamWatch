import {
  AutocompleteContext,
  CommandContext,
  CommandOptionType,
  SlashCommand,
  SlashCreator,
} from 'slash-create';
import SteamID from 'steamid';
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
  app: string;
  filetype: EPFIMFileType;
  type: WatcherType.WorkshopNew | WatcherType.WorkshopUpdate;
}

interface CommandArguments {
  app: BaseArguments;
  user: BaseArguments & { profile: string };
}

export default class WorkshopCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'workshop',
      description: 'Fetch the latest workshop item for the specified app.',
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
      options: [{
        type: CommandOptionType.SUB_COMMAND,
        name: 'app',
        description: 'Fetch the latest submission from a Steam app\'s workshop.',
        options: [
          {
            ...CommonCommandOptions.WorkshopType,
            description: 'Submission type',
          },
          CommonCommandOptions.WorkshopFileType,
          CommonCommandOptions.App,
        ],
      }, {
        type: CommandOptionType.SUB_COMMAND,
        name: 'user',
        description: 'Fetch the latest submission from a Steam user\'s workshop.',
        options: [
          {
            ...CommonCommandOptions.WorkshopType,
            description: 'Submission type',
          },
          CommonCommandOptions.WorkshopFileType,
          CommonCommandOptions.Profile,
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
    const { filetype, app: query, type } = options.app || options.user;

    const { id } = await SteamUtil.findStoreItem(query);

    if (!id) {
      return ctx.error(`Unable to find an application id for: ${query}`);
    }

    let steamID: SteamID;

    if (options.user) {
      steamID = await SteamUtil.findSteamId(options.user.profile);

      if (steamID.type === SteamID.Type.INVALID) {
        return ctx.error(`Invalid Steam identifier: ${options.user.profile}`);
      }
    }

    const app = (await db.select('*')
      .from('app')
      .where('id', id)
      .first()) || (await SteamUtil.persistApp(id));

    if (!app) {
      return ctx.error(`Unable to find an application with the id/name: ${query}`);
    }

    if (!SteamUtil.canHaveWatcher(app.type.toLowerCase() as AppType, WatcherType.WorkshopNew)) {
      return ctx.error(`Unable to fetch workshop items for apps of type **${app.type}**!`);
    }

    const files = options.app ? await steamClient.queryFiles(
      id,
      type === WatcherType.WorkshopNew
        ? EPublishedFileQueryType.RankedByPublicationDate
        : EPublishedFileQueryType.RankedByLastUpdatedDate,
      filetype,
      1,
    ) : await steamClient.getUserFiles(
      id,
      steamID!.getSteamID64(),
      filetype,
      1,
      1,
    );

    if (!files.publishedfiledetails) {
      return ctx.embed(EmbedBuilder.createApp(app, {
        description: 'No UGC found!',
        timestamp: new Date(),
        title: app.name,
        url: SteamUtil.URLS.WorkshopApp(app.id),
      }));
    }

    return ctx.embed(await EmbedBuilder.createWorkshop(app, files.publishedfiledetails[0]!, 'time_updated'));
  }
}
