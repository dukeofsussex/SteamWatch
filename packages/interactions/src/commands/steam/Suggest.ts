import { oneLine } from 'common-tags';
import {
  CommandContext,
  CommandOptionType,
  SlashCommand,
  SlashCreator,
} from 'slash-create';
import {
  EmbedBuilder,
  env,
  SteamAPI,
  steamClient,
  SteamUtil,
} from '@steamwatch/shared';
import { EResult } from 'steam-user';

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

// Bad/Not exposed typings

interface OwnedApp {
  appid: number;
  name: string;
  playtime_2weeks: number | null;
  playtime_forever: number;
  img_icon_url: string;
  img_logo_url: string;
  has_community_visible_stats: boolean;
  playtime_windows_forever: number;
  playtime_mac_forever: number;
  playtime_linux_forever: number;
}

interface UserOwnedApps {
  app_count: number;
  apps: OwnedApp[];
}

export default class SuggestCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'suggest',
      description: 'Suggest a game to play.',
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
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
  override async run(ctx: CommandContext) {
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
    const steamIds = await Promise.all(profileValues.map((p) => SteamUtil.findSteamId(p)));

    if (steamIds.some((s) => !s)) {
      return ctx.error(`Unable to get Steam profile for ${profileValues[steamIds.findIndex((s) => !s)]}.`);
    }

    const apps: UserOwnedApps[] = [];

    for (let i = 0; i < steamIds.length; i += 1) {
      const steamId = steamIds[i];

      try {
        apps.push(
          // eslint-disable-next-line no-await-in-loop
          await steamClient.getUserOwnedApps(steamId!.getSteamID64()) as unknown as UserOwnedApps,
        );
      } catch (err: any) {
        return ctx.error(oneLine`
          Unable to get games for **${profileValues[i]}**: **${(err.eresult ? EResult[err.eresult] : 'Unknown')}**.
          Please make sure game details are visible to the public!
        `);
      }
    }

    const appIds = apps.map((gs) => gs.apps.map((g) => g.appid));
    const sharedAppIds = appIds.reduce((p, c) => p.filter((pg) => c.includes(pg)));

    if (!sharedAppIds) {
      return ctx.error('Unable to find a game all accounts own.');
    }

    const appId = sharedAppIds[Math.floor(Math.random() * sharedAppIds.length)];

    const message = await EmbedBuilder.createStore(appId!, ctx.guildID);

    if (!message) {
      return ctx.error('Unable to fetch the application\'s details.');
    }

    return ctx.send(message);
  }

  // eslint-disable-next-line class-methods-use-this
  private async random(ctx: CommandContext) {
    const appId = await SteamAPI.getRandom();

    if (!appId) {
      return ctx.error('Unable to fetch a random application from the Steam store.');
    }

    const message = await EmbedBuilder.createStore(appId, ctx.guildID);

    if (!message) {
      return ctx.error('Unable to fetch the application\'s details.');
    }

    return ctx.send(message);
  }
}
