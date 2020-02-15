import { CommandMessage } from 'discord.js-commando';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import SteamWatchClient from '../../structures/SteamWatchClient';
import { insertEmoji } from '../../../utils/templateTags';

export default class GitHubCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'github',
      group: 'util',
      memberName: 'github',
      description: 'Show the GitHub repository url.',
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async run(message: CommandMessage) {
    return message.say(insertEmoji`:EYES: https://github.com/dukeofsussex/SteamWatch`);
  }
}
