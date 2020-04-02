import { CommandMessage } from 'discord.js-commando';
import SteamWatchClient from '../../structures/SteamWatchClient';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import env from '../../../env';

export default class GitHubCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'github',
      group: 'utils',
      memberName: 'github',
      description: 'Display the GitHub repository.',
    });
  }

  // eslint-disable-next-line class-methods-use-this
  run(message: CommandMessage) {
    return message.say(env.repoUrl);
  }
}
