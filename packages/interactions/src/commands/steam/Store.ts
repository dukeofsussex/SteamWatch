import {
  AutocompleteContext,
  CommandContext,
  CommandOptionType,
  SlashCommand,
  SlashCreator,
} from 'slash-create';
import { EmbedBuilder, env, SteamUtil } from '@steamwatch/shared';

interface CommandArguments {
  query: string;
}

export default class SearchCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'store',
      description: 'Search the Steam store.',
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
      options: [{
        type: CommandOptionType.STRING,
        name: 'query',
        description: 'Search term or app id',
        autocomplete: true,
        required: true,
      }],
      throttling: {
        duration: 10,
        usages: 1,
      },
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
    const { query } = ctx.options as CommandArguments;

    const appId = await SteamUtil.findAppId(query);

    if (!appId) {
      return ctx.error(`Unable to find an application with the id/name: ${query}`);
    }

    const message = await EmbedBuilder.createStore(appId, ctx.guildID);

    if (!message) {
      return ctx.error('Unable to fetch the application\'s details.');
    }

    return ctx.send(message);
  }
}
