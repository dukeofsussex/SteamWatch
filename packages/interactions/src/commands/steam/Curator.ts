import {
  CommandContext,
  CommandOptionType,
  SlashCommand,
  SlashCreator,
} from 'slash-create';
import {
  EmbedBuilder,
  env,
  SteamAPI,
  steamClient,
  SteamUtil,
} from '@steamwatch/shared';

interface CommandArguments {
  query: string;
}

export default class CuratorCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'curator',
      description: 'Fetch the latest review for the specified curator.',
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
      options: [{
        type: CommandOptionType.STRING,
        name: 'query',
        description: 'Curator id, name or url',
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
  override async run(ctx: CommandContext) {
    await ctx.defer();
    const { query } = ctx.options as CommandArguments;

    if (!steamClient.connected) {
      return ctx.error('Currently not connected to Steam. Please try again in a few minutes');
    }

    let id = SteamUtil.findGroupIdentifier(query);
    const details = await SteamAPI.getGroupDetails(id);

    if (!details || !details.is_curator) {
      return ctx.error(`Unable to find a curator page for **${query}**`);
    }

    id = details.clanAccountID;

    const reviews = await SteamAPI.getCuratorReviews(id);

    if (!reviews || !reviews.length) {
      return ctx.error(`Unable to find a review by **${query}**`);
    }

    const appInfo = (await steamClient.getProductInfo([reviews[0]!.appId], []))
      .apps[reviews[0]!.appId]!
      .appinfo
      .common;

    return ctx.embed(EmbedBuilder.createCuratorReview(appInfo, {
      avatar: SteamAPI.getGroupAvatarHash(details.avatar_medium_url),
      id,
      name: details.group_name,
    }, reviews[0]!));
  }
}
