import { Command, CommandoClient, CommandMessage } from 'discord.js-commando';
import env from '../env';

export default class InviteCommand extends Command {
  constructor(client: CommandoClient) {
    super(client, {
      name: 'invite',
      group: 'util',
      memberName: 'invite',
      description: 'Fetch the invite for the bot\'s support server',
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async run(message: CommandMessage) {
    return message.say(env.bot.invite);
  }
}
