import { oneLine, oneLineTrim } from 'common-tags';
import { CommandMessage } from 'discord.js-commando';
import SteamWatchClient from '../../structures/SteamWatchClient';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import { EMBED_COLOURS } from '../../../utils/constants';
import { insertEmoji } from '../../../utils/templateTags';


export default class InviteCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'invite',
      group: 'utils',
      memberName: 'invite',
      description: 'Invite the bot to your guild.',
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async run(message: CommandMessage) {
    return message.embed({
      color: EMBED_COLOURS.DEFAULT,
      description: insertEmoji(oneLine)`
        :TADA:
        ${oneLineTrim`
          [Invite to your guild]
          (${this.client.inviteUrl})
        `}
      `,
    });
  }
}
