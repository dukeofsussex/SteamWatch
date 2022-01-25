import { CDN, DiscordAPIError, REST as Rest } from '@discordjs/rest';
import { RESTGetAPIChannelResult, RESTGetAPIUserResult, Routes } from 'discord-api-types/v9';
import { DISCORD_ERROR_CODES } from './constants';
import env from './env';

export interface DiscordUser extends RESTGetAPIUserResult {
  avatarUrl?: string
}

let user: DiscordUser;

class DiscordAPI extends Rest {
  async getCurrentUser() {
    if (!user) {
      user = await this.get(Routes.user()) as RESTGetAPIUserResult;
      user.avatarUrl = new CDN().userAvatar(user.id, user.avatar!);
    }

    return user;
  }

  async getChannelName(channelId: string) {
    let channelName;

    try {
      channelName = (
        await this.get(Routes.channel(channelId)) as RESTGetAPIChannelResult
      ).name!;
    } catch (err) {
      const error = err as DiscordAPIError;

      switch (error.code) {
        case DISCORD_ERROR_CODES.MISSING_ACCESS:
          channelName = '[hidden]';
          break;
        case DISCORD_ERROR_CODES.UNKNOWN_CHANNEL:
          channelName = '[deleted]';
          break;
        default:
          channelName = '[unknown]';
      }
    }

    return channelName;
  }
}

export default new DiscordAPI({ version: '9' }).setToken(env.discord.token);
