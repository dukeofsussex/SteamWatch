import { CommandoMessage } from 'discord.js-commando';
import SteamWatchClient from '../../structures/SteamWatchClient';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import env from '../../../env';

export default class SupportCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'support',
      group: 'utils',
      memberName: 'support',
      description: 'Display the bot\'s support server invite.',
    });
  }

  // eslint-disable-next-line class-methods-use-this
  run(message: CommandoMessage) {
    return message.say(env.bot.invite);
  }
}
