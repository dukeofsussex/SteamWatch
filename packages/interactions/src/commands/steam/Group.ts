import {
  CommandContext,
  CommandOptionType,
  SlashCommand,
  SlashCreator,
} from 'slash-create';
import {
  db,
  EmbedBuilder,
  EMBED_COLOURS,
  env,
  GroupDetails,
  SteamAPI,
  SteamUtil,
  transformArticle,
} from '@steamwatch/shared';

interface GroupArgument {
  group: string;
}

interface CommandArguments {
  news?: GroupArgument;
  profile?: GroupArgument;
}

const GroupArg = {
  type: CommandOptionType.STRING,
  name: 'group',
  description: 'Group name or url',
  required: true,
};

export default class GroupCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'group',
      description: 'Interact with Steam groups.',
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
      options: [{
        type: CommandOptionType.SUB_COMMAND,
        name: 'news',
        description: 'Fetch the latest news post for the specified Steam group.',
        options: [
          GroupArg,
        ],
      }, {
        type: CommandOptionType.SUB_COMMAND,
        name: 'profile',
        description: 'Show the specified group\'s profile.',
        options: [
          GroupArg,
        ],
      }],
      throttling: {
        duration: 10,
        usages: 1,
      },
    });

    this.filePath = __filename;
  }

  override async run(ctx: CommandContext) {
    await ctx.defer();
    const { news, profile } = ctx.options as CommandArguments;

    if (news) {
      return this.news(ctx, {
        group: SteamUtil.findGroupVanityUrl(news.group),
      });
    }

    return this.profile(ctx, {
      group: SteamUtil.findGroupVanityUrl(profile!.group),
    });
  }

  // eslint-disable-next-line class-methods-use-this
  private async news(ctx: CommandContext, { group }: GroupArgument) {
    const details = await SteamAPI.getGroupDetails(group);

    if (!details) {
      return ctx.error(`Unable to find a group with the url ${SteamUtil.URLS.Group(group)}`);
    }

    await GroupCommand.updateGroupDetails(details);

    const news = await SteamAPI.getGroupNews(details.clanAccountID);

    if (!news) {
      return ctx.error(`Unable to find any news posts for ${details.group_name}`);
    }

    if (news.banned) {
      return ctx.error(`Unable to show banned post for ${details.group_name}`);
    }

    return ctx.embed(await EmbedBuilder.createGroupNews({
      avatar: SteamAPI.getGroupAvatarHash(details.avatar_full_url),
      id: details.clanAccountID,
      name: details.group_name,
    }, news));
  }

  // eslint-disable-next-line class-methods-use-this
  private async profile(ctx: CommandContext, { group }: GroupArgument) {
    const [details, summary] = await Promise.all([
      await SteamAPI.getGroupDetails(group),
      await SteamAPI.getGroupSummary(group),
    ]);

    if (!details || !summary) {
      return ctx.error(`Unable to find a group with the url ${SteamUtil.URLS.Group(group)}`);
    }

    await GroupCommand.updateGroupDetails(details);

    const owner = await SteamAPI.getPlayerSummary(summary.ownerId);

    return ctx.embed({
      title: details.group_name,
      description: transformArticle(summary.summary).markdown,
      color: EMBED_COLOURS.DEFAULT,
      timestamp: new Date(),
      url: SteamUtil.URLS.Group(group),
      ...(owner ? {
        author: {
          name: owner.personaname,
          icon_url: owner.avatar,
          url: SteamUtil.URLS.Profile(owner.steamid),
        },
      } : {}),
      thumbnail: {
        url: details.avatar_full_url,
      },
      footer: {
        text: summary.name,
        icon_url: details.avatar_medium_url,
      },
      fields: [{
        name: 'Member Count',
        value: summary.memberCount.toString(),
        inline: true,
      }, {
        name: 'Members Online',
        value: summary.membersOnline.toString(),
        inline: true,
      }, {
        name: 'Members In-Chat',
        value: summary.membersInChat.toString(),
        inline: true,
      }, {
        name: 'Members In-Game',
        value: summary.membersInGame.toString(),
        inline: true,
      }, {
        name: 'Steam Client Link',
        value: SteamUtil.BP.Group(details.clanAccountID),
      }],
    });
  }

  private static async updateGroupDetails(details: GroupDetails) {
    return db('`group`').update({
      avatar: SteamAPI.getGroupAvatarHash(details.avatar_full_url),
      name: details.group_name,
      vanityUrl: details.vanity_url,
    })
      .where('id', details.clanAccountID);
  }
}
