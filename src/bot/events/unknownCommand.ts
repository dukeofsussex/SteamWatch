import { oneLine } from 'common-tags';
import { CommandMessage } from 'discord.js-commando';
import { EMBED_COLOURS } from '../../utils/constants';

export default function unknownCommand(msg: CommandMessage) {
  msg.embed({
    color: EMBED_COLOURS.ERROR,
    description: oneLine`Unknown command. Use ${msg.anyUsage(
      'help',
      // @ts-ignore
      msg.guild ? undefined : null,
      msg.guild ? undefined : null,
    )} to view the command list.`,
  });
}
