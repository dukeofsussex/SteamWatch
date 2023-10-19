import { stripIndents } from 'common-tags';
import { ApplicationCommandType, CommandContext, SlashCreator } from 'slash-create';
import SteamID from 'steamid';
import { EMBED_COLOURS, env, SteamUtil } from '@steamwatch/shared';
import GuildOnlyCommand from '../../GuildOnlyCommand';

export default class IdentifiersCommand extends GuildOnlyCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'Get Steam IDs',
      type: ApplicationCommandType.MESSAGE,
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
    });

    this.filePath = __filename;
  }

  // eslint-disable-next-line class-methods-use-this
  override async run(ctx: CommandContext) {
    await ctx.defer();

    const steamID = await SteamUtil.findSteamId(ctx.targetMessage?.content ?? '');

    if (steamID.type === SteamID.Type.INVALID) {
      return ctx.error('Unable to extract Steam identifier');
    }

    return ctx.embed({
      color: EMBED_COLOURS.SUCCESS,
      timestamp: new Date(),
      fields: [{
        name: 'Extracted Steam IDs',
        value: stripIndents`
          **ID2:** ${steamID.getSteam2RenderedID()}
          **ID3:** ${steamID.getSteam3RenderedID()}
          **ID64:** ${steamID.getSteamID64()}
          **HEX:** ${BigInt(steamID.getSteamID64()).toString(16)}
        `,
      }, {
        name: 'Community Profile',
        value: `[Link](https://steamcommunity.com/profiles/${steamID.getSteamID64()})`,
      }],
    });
  }
}
