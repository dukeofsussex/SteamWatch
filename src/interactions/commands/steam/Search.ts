import {
  CommandContext,
  CommandOptionType,
  SlashCommand,
  SlashCreator,
} from 'slash-create';
import { SteamUtil } from '../../../steam/SteamUtil';
import env from '../../../utils/env';

interface CommandArguments {
  query: string;
}

export default class SuggestCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'search',
      description: 'Search Steam for an application.',
      guildIDs: env.dev ? [env.devGuildId] : undefined,
      options: [{
        type: CommandOptionType.STRING,
        name: 'query',
        description: 'Search term or app id',
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
  async run(ctx: CommandContext) {
    await ctx.defer();
    const { query } = ctx.options as CommandArguments;
    const appId = await SteamUtil.findAppId(query);

    if (!appId) {
      return ctx.error(`Unable to find an application with the id/name: ${query}`);
    }

    return SteamUtil.sendStoreEmbed(appId, ctx);
  }
}
