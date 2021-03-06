// @ts-nocheck Too many incorrect typings
import { oneLine, stripIndents } from 'common-tags';
import { MessageEmbed } from 'discord.js';
import { CommandoMessage, util } from 'discord.js-commando';
import SteamWatchClient from '../../structures/SteamWatchClient';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import { EMBED_COLOURS } from '../../../utils/constants';
import { insertEmoji } from '../../../utils/templateTags';

export default class HelpCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'help',
      group: 'utils',
      memberName: 'help',
      aliases: ['commands'],
      description: 'Display a list of available commands, or detailed information for a specified command.',
      details: stripIndents`
        The command may be part of a command name or a whole command name.
        If it isn't specified, all available commands will be listed.
      `,
      examples: ['help', 'help prefix'],
      guarded: true,
      argsPromptLimit: 0,
      args: [
        {
          key: 'command',
          prompt: 'Command',
          type: 'string',
          default: '',
        },
      ],
    });
  }

  async run(message: CommandoMessage, { command }: { command: string }) {
    const { groups } = this.client.registry;
    const commands = this.client.registry.findCommands(command, false, message);
    const showAll = command && command.toLowerCase() === 'all';

    let helpEmbed;
    const messages = [];

    if (command && !showAll) {
      if (commands.length === 0) {
        return message.embed({
          color: EMBED_COLOURS.ERROR,
          description: insertEmoji`:ERROR: Unable to identify command. Use ${message.usage(
            null,
            message.channel.type === 'dm' ? null : undefined,
            message.channel.type === 'dm' ? null : undefined,
          )} to view the list of all commands.`,
        });
      }

      if (commands.length > 15) {
        return message.embed({
          color: EMBED_COLOURS.DEFAULT,
          description: 'Multiple commands found. Please be more specific.',
        });
      }

      if (commands.length > 1) {
        return message.embed({
          color: EMBED_COLOURS.DEFAULT,
          description: util.disambiguation(commands, 'commands'),
        });
      }

      helpEmbed = new MessageEmbed({
        color: EMBED_COLOURS.DEFAULT,
        title: `Command: ${commands[0].name}${commands[0].nsfw ? ' (NSFW)' : ''}`,
        description: stripIndents`
          ${commands[0].description}
          ${commands[0].guildOnly ? ' (Usable only in servers)' : ''}
        `,
      });

      helpEmbed.addField('Format', message.anyUsage(oneLine`
        ${commands[0].name}
        ${(commands[0].format ? ` ${commands[0].format}` : '')}
      `));

      if (commands[0].aliases.length > 0) {
        helpEmbed.addField('Aliases', commands[0].aliases.join(', '), true);
      }

      helpEmbed.addField(
        'Group',
        oneLine`
          ${commands[0].group.name}
          (\`${commands[0].groupID}:${commands[0].memberName}\`)
        `,
        true,
      );

      if (commands[0].details) {
        helpEmbed.addField('Details', commands[0].details);
      }

      if (commands[0].examples) {
        helpEmbed.addField('Examples', commands[0].examples.join('\n'));
      }
    } else {
      helpEmbed = new MessageEmbed({
        color: EMBED_COLOURS.DEFAULT,
        title: `${showAll ? 'All commands' : `Available commands in ${message.guild || 'this DM'}`}`,
        description: stripIndents`
          ${oneLine`
            To run a command in ${message.guild ? message.guild.name : 'any server'}, use
            ${SteamWatchCommand.usage('command', message.guild ? message.guild.commandPrefix : null, this.client.user)}.
            For example,
            ${SteamWatchCommand.usage('prefix', message.guild ? message.guild.commandPrefix : null, this.client.user)}.
          `}
          To run a command in this DM, simply use ${SteamWatchCommand.usage('command', null, null)} with no prefix.
          Use ${this.usage('<command>', null, null)} to view detailed information about a specific command.
          Use ${this.usage('all', null, null)} to view a list of *all* commands, not just available ones.
        `,
        fields: groups
          .filter((grp) => grp.commands
            .some((cmd) => !cmd.hidden && (showAll || cmd.isUsable(message))))
          .map((grp) => ({
            name: grp.name,
            value: grp.commands.filter((cmd) => !cmd.hidden && (showAll || cmd.isUsable(message)))
              .map((cmd) => `**${cmd.name}:** ${cmd.nsfw ? ' (NSFW) ' : ''}${cmd.description}`)
              .join('\n'),
          })),
      });
    }

    try {
      messages.push(await message.direct(helpEmbed));
      if (message.channel.type !== 'dm') {
        messages.push(await message.embed({
          color: EMBED_COLOURS.SUCCESS,
          description: insertEmoji`:DM: Sent you a DM with information.`,
        }));
      }
    } catch (err) {
      messages.push(await message.embed({
        color: EMBED_COLOURS.SUCCESS,
        description: insertEmoji(oneLine)`
          :ERROR:
          Unable to send you the help DM! You probably have DMs disabled.
        `,
      }));
    }

    return messages;
  }
}
