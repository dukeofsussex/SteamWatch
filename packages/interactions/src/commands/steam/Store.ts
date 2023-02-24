import {
  AutocompleteContext,
  CommandContext,
  SlashCommand,
  SlashCreator,
} from 'slash-create';
import { EmbedBuilder, env, SteamUtil } from '@steamwatch/shared';
import CommonCommandOptions from '../../CommonCommandOptions';

interface CommandArguments {
  app: string;
}

export default class StoreCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'store',
      description: 'Search the Steam store.',
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
      options: [
        CommonCommandOptions.App,
      ],
      throttling: {
        duration: 10,
        usages: 1,
      },
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
    const { app } = ctx.options as CommandArguments;

    const appId = await SteamUtil.findAppId(app);

    if (!appId) {
      return ctx.error(`Unable to find an application with the id/name: ${app}`);
    }

    const message = await EmbedBuilder.createStore(appId, ctx.guildID);

    if (!message) {
      return ctx.error('Unable to fetch the application\'s details.');
    }

    return ctx.send(message);
  }
}
