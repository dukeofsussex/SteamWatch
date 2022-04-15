import { CommandContext, CommandOptionType, SlashCreator } from 'slash-create';
import GuildOnlyCommand from '../../GuildOnlyCommand';
import SteamUtil from '../../../steam/SteamUtil';
import { EMBED_COLOURS } from '../../../utils/constants';
import env from '../../../utils/env';

interface CommandArguments {
  url: string;
}

interface Protocol {
  regex: RegExp;
  command: (args: any) => string | Promise<string>;
}

const PROTOCOLS: Protocol[] = [
  { regex: SteamUtil.REGEXPS.AppNews, command: SteamUtil.BP.AppNews },
  { regex: SteamUtil.REGEXPS.Store, command: SteamUtil.BP.Store },
  { regex: SteamUtil.REGEXPS.UGC, command: SteamUtil.BP.UGC },
  { regex: SteamUtil.REGEXPS.Workshop, command: SteamUtil.BP.Workshop },
  { regex: SteamUtil.REGEXPS.GameHub, command: SteamUtil.BP.GameHub },
  {
    regex: SteamUtil.REGEXPS.Profile,
    command: async (id: string) => {
      const steamid = await SteamUtil.findId(id);
      return SteamUtil.BP.Profile(steamid.getSteamID64());
    },
  },
  { regex: SteamUtil.REGEXPS.Community, command: SteamUtil.BP.Community },
];

export default class OpenCommand extends GuildOnlyCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'client',
      description: 'Convert Steam browser urls to Steam client urls.',
      guildIDs: env.dev ? [env.devGuildId] : undefined,
      options: [{
        type: CommandOptionType.STRING,
        name: 'url',
        description: 'Url to be converted to a Steam browser protocol url',
        required: true,
      }],
    });

    this.filePath = __filename;
  }

  // eslint-disable-next-line class-methods-use-this
  async run(ctx: CommandContext) {
    await ctx.defer();
    const { url } = ctx.options as CommandArguments;

    for (let i = 0; i < PROTOCOLS.length; i += 1) {
      const protocol = PROTOCOLS[i];
      const match = url.match(protocol.regex);

      if (match) {
        // eslint-disable-next-line no-await-in-loop
        const command = await protocol.command(match[1]);

        return ctx.embed({
          color: EMBED_COLOURS.SUCCESS,
          timestamp: new Date(),
          fields: [{
            name: 'URL',
            value: url,
          }, {
            name: 'Steam Client Link',
            value: command,
          }],
        });
      }
    }

    return ctx.error('Unable to process url');
  }
}
