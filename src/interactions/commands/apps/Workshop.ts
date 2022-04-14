import {
  AutocompleteContext,
  CommandContext,
  CommandOptionType,
  SlashCommand,
  SlashCreator,
} from 'slash-create';
import db from '../../../db';
import SteamAPI from '../../../steam/SteamAPI';
import SteamUtil from '../../../steam/SteamUtil';
import { PERMITTED_APP_TYPES } from '../../../utils/constants';
import EmbedBuilder from '../../../utils/EmbedBuilder';
import env from '../../../utils/env';

interface CommandArguments {
  query: string;
}

export default class WorkshopCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'workshop',
      description: 'Fetch the latest workshop item for the specified app.',
      guildIDs: env.dev ? [env.devGuildId] : undefined,
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
  async autocomplete(ctx: AutocompleteContext) {
    const value = ctx.options[ctx.focused];

    return ctx.sendResults(await SteamUtil.createAppAutocomplete(value));
  }

  // eslint-disable-next-line class-methods-use-this
  async run(ctx: CommandContext) {
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

    if (!PERMITTED_APP_TYPES.workshop.includes(app.type.toLowerCase())) {
      return ctx.error(`Unable to fetch workshop items for apps of type **${app.type}**!`);
    }

    const ugc = await SteamAPI.queryFiles(appId);

    if (!ugc) {
      return ctx.embed(EmbedBuilder.createApp(app, {
        description: 'No UGC found!',
        timestamp: new Date(),
        title: app.name,
        url: SteamUtil.URLS.Workshop(app.id),
      }));
    }

    return ctx.embed(await EmbedBuilder.createWorkshop(app, ugc));
  }
}
