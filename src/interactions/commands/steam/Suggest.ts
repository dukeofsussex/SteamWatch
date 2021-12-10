import {
  CommandContext,
  CommandOptionType,
  SlashCommand,
  SlashCreator,
} from 'slash-create';
import SteamAPI from '../../../steam/SteamAPI';
import SteamUtil from '../../../steam/SteamUtil';
import env from '../../../utils/env';

interface CommandArgumentsOwned {
  profile: string;
  profile_2?: string;
  profile_3?: string;
  profile_4?: string;
  profile_5?: string;
}

interface CommandArguments {
  owned?: CommandArgumentsOwned;
  random?: {};
}

export default class SuggestCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'suggest',
      description: 'Suggest a game to play.',
      guildIDs: env.dev ? [env.devGuildId] : undefined,
      options: [{
        type: CommandOptionType.SUB_COMMAND,
        name: 'random',
        description: 'Suggest a random game from the Steam store.',
      }, {
        type: CommandOptionType.SUB_COMMAND,
        name: 'owned',
        description: 'Suggest a random game each player already owns.',
        options: [{
          type: CommandOptionType.STRING,
          name: 'profile',
          description: 'Custom url name or SteamID64',
          required: true,
        }, {
          type: CommandOptionType.STRING,
          name: 'profile_2',
          description: 'Custom url name or SteamID64',
        }, {
          type: CommandOptionType.STRING,
          name: 'profile_3',
          description: 'Custom url name or SteamID64',
        }, {
          type: CommandOptionType.STRING,
          name: 'profile_4',
          description: 'Custom url name or SteamID64',
        }, {
          type: CommandOptionType.STRING,
          name: 'profile_5',
          description: 'Custom url name or SteamID64',
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
  async run(ctx: CommandContext) {
    await ctx.defer();
    const { owned } = ctx.options as CommandArguments;

    if (owned) {
      return this.owned(ctx, owned);
    }

    return this.random(ctx);
  }

  // eslint-disable-next-line class-methods-use-this
  private async owned(ctx: CommandContext, profiles: CommandArgumentsOwned) {
    const profileValues = Object.values(profiles);
    const steamIds = await Promise.all(profileValues.map((p) => SteamUtil.findId(p)));

    if (steamIds.some((s) => !s)) {
      return ctx.error(`Unable to get Steam profile for ${profileValues[steamIds.findIndex((s) => !s)]}`);
    }

    const games = await Promise.all(steamIds.map((p) => SteamAPI.getOwnedGames(p.getSteamID64())));

    if (games.some((s) => !s)) {
      return ctx.error(`Unable to get games for ${profileValues[games.findIndex((g) => !g)]}`);
    }

    const appIds = games.map((gs) => gs!.map((g) => g.appid));
    const sharedAppIds = appIds.reduce((p, c) => p.filter((pg) => c.includes(pg)));

    if (!sharedAppIds) {
      return ctx.error('Unable to find a game all accounts own');
    }

    const appId = sharedAppIds[Math.floor(Math.random() * sharedAppIds.length)];

    const message = await SteamUtil.createStoreMessage(appId, ctx.guildID);

    if (!message) {
      return ctx.error('Unable to fetch the application\'s details');
    }

    return ctx.send(message);
  }

  // eslint-disable-next-line class-methods-use-this
  private async random(ctx: CommandContext) {
    const appId = await SteamAPI.getRandom();

    if (!appId) {
      return ctx.error('Unable to fetch a random application from the Steam store');
    }

    const message = await SteamUtil.createStoreMessage(appId, ctx.guildID);

    if (!message) {
      return ctx.error('Unable to fetch the application\'s details');
    }

    return ctx.send(message);
  }
}
