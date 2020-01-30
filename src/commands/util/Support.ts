import { oneLine } from 'common-tags';
import { CommandMessage } from 'discord.js-commando';
import env from '../../env';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import SteamWatchClient from '../../structures/SteamWatchClient';
import { insertEmoji } from '../../utils/templateTags';


export default class SupportCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'support',
      group: 'util',
      memberName: 'support',
      description: 'Show the support server invite for the bot.',
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async run(message: CommandMessage) {
    return message.say(insertEmoji(oneLine)`:EYES: ${env.bot.invite}`);
  }
}
