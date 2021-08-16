import { stripIndents } from 'common-tags';
import { CommandoGuild, CommandoMessage } from 'discord.js-commando';
import SteamWatchClient from '../../structures/SteamWatchClient';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import { EMBED_COLOURS } from '../../../utils/constants';
import { insertEmoji } from '../../../utils/templateTags';

export default class PrefixCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'prefix',
      group: 'utils',
      memberName: 'prefix',
      description: 'Display or set the command prefix.',
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
        'prefix gaben!',
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
      throttling: {
        duration: 5,
        usages: 1,
      },
    });
  }

  run(message: CommandoMessage, { prefix }: { prefix: string }) {
    if (!prefix) {
      const usedPrefix = message.guild
        ? (message.guild as CommandoGuild).commandPrefix
        : this.client.commandPrefix;

      // @ts-ignore
      return message.embed({
        color: EMBED_COLOURS.DEFAULT,
        description: stripIndents`
          ${usedPrefix ? `The command prefix is \`${usedPrefix}\`.` : 'There is no command prefix.'}
          To run commands, use ${message.anyUsage('command')}.
        `,
      });
    }

    // Check the user's permission before changing anything
    if (message.guild && !message.member!.hasPermission('ADMINISTRATOR')) {
      // @ts-ignore
      return message.embed({
        color: EMBED_COLOURS.ERROR,
        description: insertEmoji`:ERROR: Only administrators may change the command prefix!`,
      });
    }

    if (!message.guild && !this.client.isOwner(message.author)) {
      // @ts-ignore
      return message.embed({
        color: EMBED_COLOURS.ERROR,
        description: insertEmoji`:ERROR: Only the bot owner(s) may change the global command prefix!`,
      });
    }

    // Save the prefix
    const lowercasePrefix = prefix.toLowerCase();
    const usedPrefix = lowercasePrefix === 'none' ? '' : prefix;
    let response;
    if (lowercasePrefix === 'default') {
      if (message.guild) {
        // @ts-ignore Incorrect typing
        // eslint-disable-next-line no-param-reassign
        message.guild.commandPrefix = null;
      } else {
        // @ts-ignore Incorrect typing
        this.client.commandPrefix = null;
      }

      const current = this.client.commandPrefix ? `\`${this.client.commandPrefix}\`` : 'no prefix';
      response = `Reset the command prefix to the default (currently ${current}).`;
    } else {
      if (message.guild) {
        // eslint-disable-next-line no-param-reassign
        (message.guild as CommandoGuild).commandPrefix = usedPrefix;
      } else {
        this.client.commandPrefix = usedPrefix;
      }
      response = usedPrefix ? `Set the command prefix to \`${prefix}\`.` : 'Removed the command prefix entirely.';
    }

    // @ts-ignore
    return message.embed({
      color: EMBED_COLOURS.SUCCESS,
      description: insertEmoji`:SUCCESS: ${response}\nTo run commands, use ${message.anyUsage('command')}.`,
    });
  }
}
