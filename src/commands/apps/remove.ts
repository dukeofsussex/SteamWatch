// eslint-disable-next-line no-unused-vars
import { Command, CommandoClient, CommandMessage } from 'discord.js-commando';
import db from '../../db';

export default class RemoveCommand extends Command {
  constructor(client: CommandoClient) {
    super(client, {
      name: 'remove',
      group: 'apps',
      memberName: 'remove',
      description: 'Remove a watcher.',
      guildOnly: true,
      // @ts-ignore
      userPermissions: ['MANAGE_CHANNELS'],
      argsPromptLimit: 0,
      args: [
        {
          key: 'id',
          prompt: 'Watcher id',
          type: 'integer',
        },
      ],
      throttling: {
        duration: 10,
        usages: 2,
      },
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async run(message: CommandMessage, { id }: { id: number }) {
    const removed = await db.delete()
      .from('app_watcher')
      .where({
        id,
        guildId: message.guild.id,
      });

    if (removed === 0) {
      return message.say(`Unable to remove the watcher **#${id}**!`);
    }

    return message.say('Watcher removed.');
  }
}
