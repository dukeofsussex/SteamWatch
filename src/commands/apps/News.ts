import { CommandMessage } from 'discord.js-commando';
import db from '../../db';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import SteamWatchClient from '../../structures/SteamWatchClient';
import { EMBED_COLOURS } from '../../utils/constants';
import { insertEmoji } from '../../utils/templateTags';

export default class NewsCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'news',
      group: 'apps',
      memberName: 'news',
      description: 'Fetch cached news articles for the specified app id.',
      examples: [
        'news 730',
        'news 730 2',
      ],
      argsPromptLimit: 0,
      args: [
        {
          key: 'appid',
          prompt: 'App identifier',
          type: 'integer',
        },
        {
          key: 'count',
          prompt: 'Count',
          type: 'integer',
          default: 1,
          max: 5,
          min: 1,
        },
      ],
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async run(message: CommandMessage, { appid, count }: { appid: number, count: number }) {
    const news = await db.select('url')
      .from('app_news')
      .where('app_id', appid)
      .orderBy('created_at', 'desc')
      .limit(count);

    if (news.length === 0) {
      return message.embed({
        color: EMBED_COLOURS.DEFAULT,
        description: 'No cached news available!',
      });
    }

    return message.say(insertEmoji`:SUCCESS: ${news.map((n) => `<${n.url}>`).join('\n')}`);
  }
}
