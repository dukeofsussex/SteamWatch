import {
  AutocompleteContext,
  CommandContext,
  CommandOptionType,
  SlashCommand,
  SlashCreator,
} from 'slash-create';
import SteamUser from 'steam-user';
import {
  EmbedBuilder,
  EMBED_COLOURS,
  EMOJIS,
  env,
  FileType,
  PublishedFile,
  SteamAPI,
  steamClient,
  SteamUtil,
  transformArticle,
} from '@steamwatch/shared';

interface Arguments {
  query: string;
}

interface CommandArguments {
  app?: Arguments;
  ugc?: Arguments;
}

export default class SearchCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'search',
      description: 'Search Steam.',
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
      options: [{
        type: CommandOptionType.SUB_COMMAND,
        name: 'app',
        description: 'Search the store.',
        options: [{
          type: CommandOptionType.STRING,
          name: 'query',
          description: 'Search term or app id',
          autocomplete: true,
          required: true,
        }],
      }, {
        type: CommandOptionType.SUB_COMMAND,
        name: 'ugc',
        description: 'Search the workshop.',
        options: [{
          type: CommandOptionType.STRING,
          name: 'query',
          description: 'UGC url or item id',
          required: true,
        }],
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
    const { app, ugc } = ctx.options as CommandArguments;

    if (app) {
      return SearchCommand.searchApp(ctx, app.query);
    }

    return SearchCommand.searchUGC(ctx, ugc!.query);
  }

  private static async searchApp(ctx: CommandContext, query: string) {
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

  private static async searchUGC(ctx: CommandContext, query: string) {
    if (!steamClient.connected) {
      return ctx.error('Currently not connected to Steam. Please try again in a few minutes');
    }

    const ugcId = SteamUtil.findUGCId(query);

    if (!ugcId) {
      return ctx.error(`Unable to parse UGC identifier: ${query}`);
    }

    const published = (await steamClient.getPublishedFileDetails([parseInt(ugcId, 10)])) as any;
    const file = published?.files?.[ugcId] as PublishedFile;

    if (!file) {
      return ctx.error(`Unable to find UGC with the id/url: ${query}`);
    }

    if (file.result !== SteamUser.EResult.OK) {
      return ctx.error(`Unable to process UGC: ${SteamUser.EResult[file.result]}`);
    }

    const [app, profile] = await Promise.all([
      steamClient.getProductInfo([file.consumer_appid], [], true),
      SteamAPI.getPlayerSummary(file.creator),
    ]);

    const appInfo = app.apps[file.consumer_appid]?.appinfo;

    if (!appInfo || !profile) {
      return ctx.error(`Unable to process app info: ${query}`);
    }

    const transformed = transformArticle(file.file_description);

    return ctx.embed({
      author: {
        name: profile.personaname,
        icon_url: profile.avatarfull,
        url: SteamUtil.URLS.Profile(profile.steamid),
      },
      color: EMBED_COLOURS.DEFAULT,
      description: transformed.markdown,
      footer: {
        text: appInfo.common.name,
        icon_url: SteamUtil.URLS.Icon(file.consumer_appid, appInfo.common.icon),
      },
      thumbnail: {
        url: file.preview_url,
      },
      timestamp: new Date(file.time_updated * 1000),
      title: file.title,
      url: SteamUtil.URLS.UGC(ugcId),
      fields: [{
        name: 'Created',
        value: `<t:${file.time_created}>`,
        inline: true,
      }, {
        name: 'Updated',
        value: `<t:${file.time_updated}>`,
        inline: true,
      }, {
        name: 'Visibility',
        value: SteamUser.EPublishedFileVisibility[file.visibility]! || 'N/A',
        inline: true,
      }, {
        name: 'Favourites',
        value: file.favorited.toString(),
        inline: true,
      },
      ...(file.can_subscribe ? [{
        name: 'Subscriptions',
        value: file.subscriptions.toString(),
        inline: true,
      }] : []),
      {
        name: 'Views',
        value: file.views.toString(),
        inline: true,
      }, {
        name: 'Lifetime Favs',
        value: file.lifetime_favorited.toString(),
        inline: true,
      },
      ...(file.can_subscribe ? [{
        name: 'Lifetime Subs',
        value: file.lifetime_subscriptions.toString(),
        inline: true,
      }] : []),
      {
        name: 'Tags',
        value: file.tags.map((tag) => tag.tag).join('\n') || 'None',
        inline: true,
      },
      ...(file.banned ? [{
        name: `${EMOJIS.ALERT} Banned`,
        value: file.ban_reason,
      }] : []),
      ...([FileType.Art, FileType.Normal, FileType.Screenshot].includes(file.file_type) ? [{
        name: 'File Size',
        value: SteamUtil.formatFileSize(parseInt(file.file_size, 10)),
        inline: true,
      }] : []),
      {
        name: 'Steam Client Link',
        value: SteamUtil.BP.UGC(ugcId),
      }],
    });
  }
}
