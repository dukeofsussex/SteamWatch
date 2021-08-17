import { oneLine, stripIndents } from 'common-tags';
import { formatDistanceToNow } from 'date-fns';
import {
  CommandContext,
  CommandOptionType,
  SlashCommand,
  SlashCreator,
} from 'slash-create';
import SteamID from 'steamid';
import SteamAPI, { CommunityVisibilityState } from '../../../steam/SteamAPI';
import { SteamUtil } from '../../../steam/SteamUtil';
import { EMBED_COLOURS } from '../../../utils/constants';
import env from '../../../utils/env';
import Util from '../../../utils/Util';

interface CommandArguments {
  profile: string;
}

export default class SuggestCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'profile',
      description: 'Show a player\'s Steam profile.',
      guildIDs: env.dev ? [env.devGuildId] : undefined,
      options: [{
        type: CommandOptionType.STRING,
        name: 'profile',
        description: 'Custom url name or SteamID64',
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

    const { profile } = ctx.options as CommandArguments;

    const steamID = await SteamUtil.findId(profile);

    if (steamID.type === SteamID.Type.INVALID) {
      return ctx.error(`Invalid Steam identifier: ${profile}`);
    }

    const steamID64 = steamID.getSteamID64();

    const [bans, summary, level] = await Promise.all([
      SteamAPI.getPlayerBans(steamID64),
      SteamAPI.getPlayerSummary(steamID64),
      SteamAPI.getSteamLevel(steamID64),
    ]);

    if (!bans || !summary) {
      return ctx.error('Unable to process Steam profile');
    }

    return ctx.embed({
      title: oneLine`
        ${(summary.loccountrycode ? Util.getFlagEmoji(summary.loccountrycode) : '')}
        ${summary.personaname}
      `,
      thumbnail: {
        url: summary.avatarfull,
      },
      color: EMBED_COLOURS.DEFAULT,
      description: stripIndents`
        **Level**: ${level || 'N/A'}
        **Profile Visibility:** ${CommunityVisibilityState[summary.communityvisibilitystate]}
      `,
      timestamp: new Date(),
      fields: [{
        name: 'Ban States',
        value: stripIndents`
            ${Util.getStateEmoji(!bans.CommunityBanned)} **Community**
            ${Util.getStateEmoji(bans.EconomyBan === 'none')} **Economy**
            ${Util.getStateEmoji(!bans.NumberOfGameBans)} **Game:** ${bans.NumberOfGameBans}
            ${Util.getStateEmoji(!bans.VACBanned)} **VAC:** ${bans.NumberOfVACBans}
            ${(bans.DaysSinceLastBan ? `**[ ${bans.DaysSinceLastBan} ]** day(s) since last ban` : '')}
          `,
        inline: true,
      }, {
        name: 'Steam IDs',
        value: stripIndents`
            **ID3:** ${steamID.getSteam2RenderedID()}
            **ID32:** ${steamID.getSteam3RenderedID()}
            **ID64:** ${steamID64}
          `,
        inline: true,
      }, {
        name: 'Steam Client Link',
        value: SteamUtil.BP.Profile(steamID64),
      }],
      footer: {
        text: `Last seen: ${(summary.lastlogoff ? formatDistanceToNow(new Date(summary.lastlogoff * 1000), { addSuffix: true }) : 'Unknown')}`,
      },
      url: summary.profileurl,
    });
  }
}
