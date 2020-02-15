import { oneLine } from 'common-tags';
import { CommandMessage } from 'discord.js-commando';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import SteamWatchClient from '../../structures/SteamWatchClient';
import { insertEmoji } from '../../../utils/templateTags';


export default class InviteCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'invite',
      group: 'util',
      memberName: 'invite',
      description: 'Show the invite url for the bot.',
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async run(message: CommandMessage) {
    return message.say(insertEmoji(oneLine)`
      :EYES:
      <https://discordapp.com/oauth2/authorize?client_id=${this.client.user.id}&scope=bot>
    `);
  }
}
