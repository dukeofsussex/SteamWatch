import { stripIndents } from 'common-tags';
import { CommandMessage, GuildExtension } from 'discord.js-commando';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import SteamWatchClient from '../../structures/SteamWatchClient';
import { EMBED_COLOURS } from '../../utils/constants';
import { insertEmoji } from '../../utils/templateTags';

export default class PrefixCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'prefix',
      group: 'util',
      memberName: 'prefix',
      description: 'Show or set the command prefix.',
      format: '[prefix | "default" | "none"]',
      details: stripIndents`
        If no prefix is provided, the current prefix will be shown.
        If the prefix is \`default\`, the prefix will be reset to the bot's default prefix.
        If the prefix is \`none\`, the prefix will be removed entirely, only allowing mentions to run commands.
        Only administrators may change the prefix.
      `,
      examples: [
        'prefix',
        'prefix -',
        'prefix omg!',
        'prefix default',
        'prefix none',
      ],
      argsPromptLimit: 0,
      args: [
        {
          key: 'prefix',
          prompt: 'Prefix',
          type: 'string',
          max: 15,
          default: '',
        },
      ],
    });
  }

  async run(msg: CommandMessage, { prefix }: { prefix: string }) {
    if (!prefix) {
      const usedPrefix = msg.guild
        ? (msg.guild as GuildExtension).commandPrefix
        : this.client.commandPrefix;
      return msg.embed({
        color: EMBED_COLOURS.DEFAULT,
        description: stripIndents`
          ${prefix ? `The command prefix is \`${usedPrefix}\`.` : 'There is no command prefix.'}
          To run commands, use ${msg.anyUsage('command')}.
        `,
      });
    }

    // Check the user's permission before changing anything
    if (msg.guild && (!msg.member.hasPermission('ADMINISTRATOR') || !this.client.isOwner(msg.author))) {
      return msg.embed({
        color: EMBED_COLOURS.ERROR,
        description: insertEmoji`:ERROR: Only administrators may change the command prefix!`,
      });
    }

    if (!msg.guild && !this.client.isOwner(msg.author)) {
      return msg.embed({
        color: EMBED_COLOURS.ERROR,
        description: insertEmoji`:ERROR: Only the bot owner(s) may change the global command prefix!`,
      });
    }

    // Save the prefix
    const lowercase = prefix.toLowerCase();
    const usedPrefix = lowercase === 'none' ? '' : prefix;
    let response;
    if (lowercase === 'default') {
      if (msg.guild) {
        // @ts-ignore Incorrect typing
        // eslint-disable-next-line no-param-reassign
        msg.guild.commandPrefix = null;
      } else {
        // @ts-ignore Incorrect typing
        this.client.commandPrefix = null;
      }

      const current = this.client.commandPrefix ? `\`${this.client.commandPrefix}\`` : 'no prefix';
      response = `Reset the command prefix to the default (currently ${current}).`;
    } else {
      if (msg.guild) {
        // eslint-disable-next-line no-param-reassign
        (msg.guild as GuildExtension).commandPrefix = usedPrefix;
      } else {
        this.client.commandPrefix = usedPrefix;
      }
      response = usedPrefix ? `Set the command prefix to \`${prefix}\`.` : 'Removed the command prefix entirely.';
    }

    return msg.embed({
      color: EMBED_COLOURS.SUCCESS,
      description: insertEmoji`:SUCCESS: ${response}\nTo run commands, use ${msg.anyUsage('command')}.`,
    });
  }
}
