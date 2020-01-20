import { Command, CommandoClient, CommandMessage } from 'discord.js-commando';
import db from '../../db';
import CURRENCIES from '../../utils/currencies';

export default class CurrencyCommand extends Command {
  constructor(client: CommandoClient) {
    super(client, {
      name: 'currency',
      group: 'apps',
      memberName: 'currency',
      description: 'Fetches or sets the app currency for the guild.',
      guildOnly: true,
      // @ts-ignore
      userPermissions: ['MANAGE_CHANNELS'],
      argsPromptLimit: 0,
      args: [
        {
          key: 'currency',
          prompt: 'Missing currency',
          type: 'string',
          default: '',
        },
      ],
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async run(message: CommandMessage, { currency }: { currency: string }) {
    if (!currency) {
      const dbCurrency = await db.select('currency')
        .from('guild')
        .first()
        .then((result) => result.currency);

      const curr = CURRENCIES.get(dbCurrency);

      return message.say(`Current currency is ${curr!.flag} **${dbCurrency}** (${curr!.name})`);
    }

    const uCurrency = currency.toUpperCase();

    if (!CURRENCIES.has(uCurrency)) {
      return message.say(`Unknown currency **${currency}**!`);
    }

    const curr = CURRENCIES.get(uCurrency);

    await db('guild').update('currency', uCurrency)
      .where('guild_id', message.guild.id);

    return message.say(`Set the used currency to ${curr!.flag} **${uCurrency}** (${curr!.name})`);
  }
}
