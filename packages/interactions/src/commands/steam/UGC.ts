import { CommandContext, SlashCommand, SlashCreator } from 'slash-create';
import SteamUser from 'steam-user';
import {
  EMBED_COLOURS,
  EMOJIS,
  env,
  EWorkshopFileType,
  PublishedFile,
  SteamAPI,
  steamClient,
  SteamUtil,
  transformArticle,
} from '@steamwatch/shared';
import CommonCommandOptions from '../../CommonCommandOptions';

interface CommandArguments {
  ugc: string;
}

export default class UGCCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'ugc',
      description: 'Search the Steam workshop.',
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
      options: [
        CommonCommandOptions.UGC,
      ],
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
    const { ugc } = ctx.options as CommandArguments;

    if (!steamClient.connected) {
      return ctx.error('Currently not connected to Steam. Please try again in a few minutes');
    }

    const ugcId = SteamUtil.findUGCId(ugc);

    if (!ugcId) {
      return ctx.error(`Unable to parse UGC identifier: ${ugc}`);
    }

    const published = (await steamClient.getPublishedFileDetails([parseInt(ugcId, 10)])) as any;
    const file = published?.files?.[ugcId] as PublishedFile;

    if (!file) {
      return ctx.error(`Unable to find UGC with the id/url: ${ugc}`);
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
      return ctx.error(`Unable to process app info: ${ugc}`);
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
      {
        name: 'Type',
        value: EWorkshopFileType[file.file_type] || 'Unknown',
        inline: true,
      },
      ...([
        EWorkshopFileType.Art,
        EWorkshopFileType.Item,
        EWorkshopFileType.Microtransaction,
        EWorkshopFileType.Screenshot,
        EWorkshopFileType.WebGuide,
      ].includes(file.file_type) ? [{
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
