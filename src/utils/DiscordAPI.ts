import { CDN, REST as Rest } from '@discordjs/rest';
import { RESTGetAPIUserResult, Routes } from 'discord-api-types/v9';
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
}

export default new DiscordAPI({ version: '9' }).setToken(env.discord.token);
