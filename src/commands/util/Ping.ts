import { oneLine } from 'common-tags';
import { Message } from 'discord.js';
import { CommandMessage } from 'discord.js-commando';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import SteamWatchClient from '../../structures/SteamWatchClient';
import { EMBED_COLOURS } from '../../utils/constants';
import { insertEmoji } from '../../utils/templateTags';

export default class PingCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'ping',
      group: 'util',
      memberName: 'ping',
      description: 'Check the bot\'s ping to the Discord server.',
      throttling: {
        duration: 5,
        usages: 1,
      },
    });
  }

  async run(msg: CommandMessage) {
    const pingMsg = await (msg.embed({
      color: EMBED_COLOURS.PENDING,
      description: 'Pinging...',
    })) as Message;

    return pingMsg.edit({
      embed: {
        color: EMBED_COLOURS.DEFAULT,
        description: insertEmoji(oneLine)`
          :PING_PONG: Pong! Message round-trip took
          \`${(pingMsg.editedTimestamp || pingMsg.createdTimestamp)
            - (msg.editedTimestamp || msg.createdTimestamp)}ms\`.
          Heartbeat ping is \`${Math.round(this.client.ping)}ms\`.
        `,
      },
    });
  }
}
