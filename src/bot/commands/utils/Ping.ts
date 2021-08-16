import { oneLine } from 'common-tags';
import { Message } from 'discord.js';
import { CommandoMessage } from 'discord.js-commando';
import SteamWatchClient from '../../structures/SteamWatchClient';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import { EMBED_COLOURS } from '../../../utils/constants';
import { insertEmoji } from '../../../utils/templateTags';

export default class PingCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'ping',
      group: 'utils',
      memberName: 'ping',
      description: 'Check the bot\'s ping to the Discord gateway.',
      throttling: {
        duration: 15,
        usages: 1,
      },
    });
  }

  async run(msg: CommandoMessage) {
    // @ts-ignore
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
          Heartbeat ping is \`${Math.round(this.client.ws.ping)}ms\`.
        `,
      },
    });
  }
}
