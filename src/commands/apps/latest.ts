// eslint-disable-next-line no-unused-vars
import { Command, CommandoClient, CommandMessage } from 'discord.js-commando';
import db from '../../db';

export default class LatestCommand extends Command {
  constructor(client: CommandoClient) {
    super(client, {
      name: 'latest',
      group: 'apps',
      memberName: 'latest',
      description: 'Fetches the latest news articles for the specified app id.',
      guildOnly: true,
      // @ts-ignore
      userPermissions: ['MANAGE_CHANNELS'],
      argsPromptLimit: 0,
      args: [
        {
          key: 'appid',
          prompt: 'Missing app id',
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
      return message.say('No news available');
    }

    return message.say(news.map((n) => n.url).join('\n'));
  }
}
