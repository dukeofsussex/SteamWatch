import { ApplicationCommandType, CommandContext, SlashCreator } from 'slash-create';
import {
  EMBED_COLOURS,
  env,
  SteamAPI,
  SteamUtil,
} from '@steamwatch/shared';
import GuildOnlyCommand from '../../GuildOnlyCommand';

interface Protocol {
  regex: RegExp;
  command: (...args: any[]) => string | Promise<string>;
}

const PROTOCOLS: Protocol[] = [
  { regex: SteamUtil.REGEXPS.EventAnnouncement, command: SteamUtil.BP.EventAnnouncement },
  { regex: SteamUtil.REGEXPS.AppNews, command: SteamUtil.BP.AppNews },
  { regex: SteamUtil.REGEXPS.Store, command: SteamUtil.BP.Store },
  { regex: SteamUtil.REGEXPS.UGC, command: SteamUtil.BP.UGC },
  { regex: SteamUtil.REGEXPS.Workshop, command: SteamUtil.BP.Workshop },
  { regex: SteamUtil.REGEXPS.GameHub, command: SteamUtil.BP.GameHub },
  {
    regex: SteamUtil.REGEXPS.Group,
    command: async (name: string) => {
      const groupDetails = await SteamAPI.getGroupDetails(name);
      return SteamUtil.BP.Group(groupDetails!.clanAccountID);
    },
  },
  {
    regex: SteamUtil.REGEXPS.Profile,
    command: async (id: string) => {
      const steamid = await SteamUtil.findSteamId(id);
      return SteamUtil.BP.Profile(steamid.getSteamID64());
    },
  },
  { regex: SteamUtil.REGEXPS.Community, command: SteamUtil.BP.Community },
];

export default class ClientLinksCommand extends GuildOnlyCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'Get Client Links',
      type: ApplicationCommandType.MESSAGE,
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
    });

    this.filePath = __filename;
  }

  // eslint-disable-next-line class-methods-use-this
  override async run(ctx: CommandContext) {
    await ctx.defer();

    const clientUrls: string[] = [];
    const urls = ctx.targetMessage?.content.match(/(?:https?:\/\/)?(?:steamcommunity.com|store.steampowered.com)[-\w()@:%+.~#?&/=]*/g) ?? [];

    for (let i = 0; i < urls.length; i += 1) {
      const url = urls[i];

      for (let j = 0; j < PROTOCOLS.length; j += 1) {
        const protocol = PROTOCOLS[j] as Protocol;
        const match = url!.match(protocol.regex);

        if (match) {
          // eslint-disable-next-line no-await-in-loop
          clientUrls.push(`${url}\n> ${await protocol.command(...match.slice(1))}`);
          break;
        }
      }
    }

    if (clientUrls.length) {
      return ctx.embed({
        color: EMBED_COLOURS.SUCCESS,
        timestamp: new Date(),
        fields: [{
          name: 'Extracted Steam Client Links',
          value: clientUrls.join('\n\n'),
        }],
      });
    }

    return ctx.error(urls.length === 0 ? 'No Steam links detected.' : 'Unable to extract Steam Client links.');
  }
}
