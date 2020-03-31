import { CommandMessage } from 'discord.js-commando';
import SteamWatchClient from '../../structures/SteamWatchClient';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import env from '../../../env';
import { insertEmoji } from '../../../utils/templateTags';

export default class ClearCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'clear',
      group: 'utils',
      memberName: 'clear',
      description: 'Tidy up this mess!',
      guildOnly: true,
      ownerOnly: true,
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async run(message: CommandMessage) {
    if (!env.dev) {
      return message.say(insertEmoji`:ERROR: Only available in dev mode!`);
    }

    await message.channel.bulkDelete(25);
    return message.say(insertEmoji`:SUCCESS: Cleared!`);
  }
}
