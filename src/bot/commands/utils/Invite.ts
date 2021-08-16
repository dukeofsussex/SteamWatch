import { oneLine, oneLineTrim } from 'common-tags';
import { CommandoMessage } from 'discord.js-commando';
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
      clientPermissions: ['EMBED_LINKS'],
    });
  }

  // eslint-disable-next-line class-methods-use-this
  run(message: CommandoMessage) {
    // @ts-ignore
    return message.embed({
      color: EMBED_COLOURS.DEFAULT,
      description: insertEmoji(oneLine)`
        :TADA:
        ${oneLineTrim`
          [Invite me to your guild]
          (${this.client.inviteUrl})
        `}
      `,
    });
  }
}
