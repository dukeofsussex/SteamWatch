import { Command, CommandoClient, CommandMessage } from 'discord.js-commando';

export default class AddCommand extends Command {
  constructor(client: CommandoClient) {
    super(client, {
      name: 'clear',
      group: 'util',
      memberName: 'clear',
      description: 'Tidy up this mess',
      guildOnly: true,
      ownerOnly: true,
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async run(message: CommandMessage) {
    await message.channel.bulkDelete(25);
    return message.say('Cleared');
  }
}
