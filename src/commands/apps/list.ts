import { Command, CommandoClient, CommandMessage } from 'discord.js-commando';
import { GuildChannel, TextChannel } from 'discord.js';
import db from '../../db';

const table = require('markdown-table');

const watcherQuery = db.select('app_watcher.id', 'app_id', 'channel_id', 'name', 'last_checked')
  .from('app')
  .innerJoin('app_watcher', 'app.id', 'app_watcher.app_id');

export default class ListCommand extends Command {
  constructor(client: CommandoClient) {
    super(client, {
      name: 'list',
      group: 'apps',
      memberName: 'list',
      description: 'Fetches the list of current watchers.',
      guildOnly: true,
      // @ts-ignore
      userPermissions: ['MANAGE_CHANNELS'],
      argsPromptLimit: 0,
      args: [
        {
          key: 'identifier',
          prompt: 'Missing identifier',
          type: 'channel|integer',
          default: -1,
        },
      ],
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async run(message: CommandMessage, { identifier }: { identifier: number | GuildChannel }) {
    let query = watcherQuery.where('guild_id', message.guild.id);
    let notFoundCategory = 'for this guild';

    if (typeof identifier === 'number' && identifier !== -1) {
      query = query.andWhere('app_id', identifier);
      notFoundCategory = `for **${identifier}**`;
    } else if (identifier instanceof GuildChannel) {
      if (!(identifier instanceof TextChannel)) {
        return message.say(`<#${identifier.id}> isn't a text channel`);
      }
      query = query.andWhere('channel_id', identifier.id);
      notFoundCategory = `for <#${identifier.id}>`;
    }

    const watchers = await query;

    if (watchers.length === 0) {
      return message.say(`No watchers configured ${notFoundCategory}!`);
    }

    return message.code('md', table([['Id', 'App Id', 'Name', 'Channel', 'Last Checked'],
      ...watchers.map((w) => [
        w.id,
        w.appId,
        w.name,
        `#${message.guild.channels.get(w.channelId)?.name}`,
        !w.lastChecked ? 'Never' : w.lastChecked.toUTCString()
          .slice(5),
      ])]));
  }
}
