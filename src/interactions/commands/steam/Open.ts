import { CommandContext, CommandOptionType, SlashCreator } from 'slash-create';
import GuildOnlyCommand from '../../GuildOnlyCommand';
import { SteamUtil } from '../../../steam/SteamUtil';
import { EMBED_COLOURS, EMOJIS } from '../../../utils/constants';
import env from '../../../utils/env';

interface CommandArguments {
  url: string;
}

interface Protocol {
  regex: RegExp;
  command: (args: any) => string | Promise<string>;
}

const PROTOCOLS: Protocol[] = [
  { regex: /news\/app\/(\d+)/, command: SteamUtil.BP.AppNews },
  { regex: /steampowered\.com\/app\/(\d+)/, command: SteamUtil.BP.Store },
  { regex: /sharedfiles\/filedetails\/\?id=(\d+)/, command: SteamUtil.BP.WorkshopItem },
  { regex: /steamcommunity\.com\/app\/(\d+)\/workshop/, command: SteamUtil.BP.Workshop },
  { regex: /steamcommunity\.com\/app\/(\d+)/, command: SteamUtil.BP.GameHub },
  {
    regex: /steamcommunity\.com\/(?:profiles|id)\/([0-9]{17}|[\w-]{2,32})/,
    command: async (id: string) => {
      const steamid = await SteamUtil.findId(id);
      return SteamUtil.BP.Profile(steamid.getSteamID64());
    },
  },
  { regex: /steamcommunity\.com/, command: SteamUtil.BP.Community },
];

export default class OpenCommand extends GuildOnlyCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'open',
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
    const { url } = ctx.options as CommandArguments;

    for (let i = 0; i < PROTOCOLS.length; i += 1) {
      const protocol = PROTOCOLS[i];
      const match = url.match(protocol.regex);

      if (match) {
        // eslint-disable-next-line no-await-in-loop
        const command = await protocol.command(match[1]);

        return ctx.embed({
          color: EMBED_COLOURS.DEFAULT,
          description: `${EMOJIS.TADA} ${command}`,
        });
      }
    }

    return ctx.error('Unable to process url');
  }
}
