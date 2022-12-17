import {
  AutocompleteContext,
  CommandContext,
  CommandOptionType,
  SlashCommand,
  SlashCreator,
} from 'slash-create';
import { EPublishedFileVisibility, EResult } from 'steam-user';
import {
  EmbedBuilder,
  EMBED_COLOURS,
  EMOJIS,
  env,
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
    const ugcId = SteamUtil.findUGCId(query);

    if (!ugcId) {
      return ctx.error(`Unable to parse UGC identifier: ${query}`);
    }

    const ugc = (await SteamAPI.getPublishedFileDetails([ugcId]))?.[0];

    if (!ugc) {
      return ctx.error(`Unable to find UGC with the id/url: ${query}`);
    }

    if (ugc.result !== EResult.OK) {
      return ctx.error(`Unable to process UGC: ${EResult[ugc.result]}`);
    }

    const [app, profile] = await Promise.all([
      steamClient.getProductInfo([ugc.consumer_app_id], [], true),
      SteamAPI.getPlayerSummary(ugc.creator),
    ]);

    const appInfo = app.apps[ugc.consumer_app_id]?.appinfo;

    if (!appInfo || !profile) {
      return ctx.error(`Unable to find UGC with the id/url: ${query}`);
    }

    const transformed = transformArticle(ugc.description);

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
        icon_url: SteamUtil.URLS.Icon(ugc.consumer_app_id, appInfo.common.icon),
      },
      thumbnail: {
        url: ugc.preview_url,
      },
      timestamp: new Date(ugc.time_updated * 1000),
      title: ugc.title,
      url: SteamUtil.URLS.UGC(ugcId),
      fields: [{
        name: 'Created',
        value: `<t:${ugc.time_created}>`,
        inline: true,
      }, {
        name: 'Updated',
        value: `<t:${ugc.time_updated}>`,
        inline: true,
      }, {
        name: 'Visibility',
        value: EPublishedFileVisibility[ugc.visibility]!,
        inline: true,
      }, {
        name: 'Favourites',
        value: ugc.favorited.toString(),
        inline: true,
      }, {
        name: 'Subscriptions',
        value: ugc.subscriptions.toString(),
        inline: true,
      }, {
        name: 'Views',
        value: ugc.views.toString(),
        inline: true,
      }, {
        name: 'Lifetime Favs',
        value: ugc.lifetime_favorited.toString(),
        inline: true,
      }, {
        name: 'Lifetime Subs',
        value: ugc.lifetime_subscriptions.toString(),
        inline: true,
      }, {
        name: 'Tags',
        value: ugc.tags.map((tag) => tag.tag).join('\n') || 'None',
        inline: true,
      },
      ...(ugc.banned ? [{
        name: `${EMOJIS.ALERT} Banned`,
        value: ugc.ban_reason,
      }] : []),
      {
        name: 'Steam Client Link',
        value: SteamUtil.BP.UGC(ugcId),
      }],
    });
  }
}
