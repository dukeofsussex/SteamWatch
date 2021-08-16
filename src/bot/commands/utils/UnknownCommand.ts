import { oneLine } from 'common-tags';
import { CommandoMessage } from 'discord.js-commando';
import SteamWatchClient from '../../structures/SteamWatchClient';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import { EMBED_COLOURS } from '../../../utils/constants';

export default class UnknownCommandCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'unknown-command',
      group: 'utils',
      memberName: 'unknown-command',
      description: 'Display help information for when an unknown command is used.',
      hidden: true,
      unknown: true,
    });
  }

  // eslint-disable-next-line class-methods-use-this
  run(message: CommandoMessage) {
    // @ts-ignore
    return message.embed({
      color: EMBED_COLOURS.ERROR,
      description: oneLine`Unknown command. Use ${message.anyUsage(
        'help',
        // @ts-ignore Incorrect typing
        message.guild ? undefined : null,
        message.guild ? undefined : null,
      )} to view the command list.`,
    });
  }
}
