import { oneLine } from 'common-tags';
import { CommandMessage } from 'discord.js-commando';
import db from '../../db';
import WebApi from '../../steam/WebApi';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import SteamWatchClient from '../../structures/SteamWatchClient';
import { CURRENCIES, EMBED_COLOURS } from '../../utils/constants';
import { insertEmoji } from '../../utils/templateTags';

export default class CurrencyCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'currency',
      group: 'apps',
      memberName: 'currency',
      description: 'Fetch or set the app currency for the guild.',
      details: 'A list of currencies can be found at https://partner.steamgames.com/doc/store/pricing/currencies',
      examples: [
        'currency',
        'currency USD',
        'currency CIS-USD',
      ],
      guildOnly: true,
      // @ts-ignore Missing typings
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
      const dbCurrency = await db.select('currency.*')
        .from('guild')
        .innerJoin('currency', 'currency.id', 'guild.currency_id')
        .where('guild.id', message.guild.id)
        .first();

      return message.embed({
        color: EMBED_COLOURS.DEFAULT,
        description: oneLine`
          ${CURRENCIES[dbCurrency.abbreviation].flag}
          Current currency is **${dbCurrency.abbreviation}**
          (${dbCurrency.name}).
        `,
      });
    }

    const dbCurrency = await db.select('*')
      .from('currency')
      .where('abbreviation', currency.toUpperCase())
      .first();

    if (!dbCurrency) {
      return message.embed({
        color: EMBED_COLOURS.ERROR,
        description: insertEmoji`:ERROR: Unknown currency **${currency}**!`,
      });
    }

    // Fetch all apps that aren't already being tracked in the new currency
    const apps = await db.select('app.id', 'app.name')
      .from('guild')
      .innerJoin('app_watcher', 'app_watcher.guild_id', 'guild.id')
      .innerJoin('app', 'app.id', 'app_watcher.app_id')
      .innerJoin({ currentAppPrice: 'app_price' }, function appPriceInnerJoin() {
        this.on('current_app_price.app_id', '=', 'app_watcher.app_id')
          .andOn('current_app_price.currency_id', '=', 'guild.currency_id');
      })
      .leftJoin({ newAppPrice: 'app_price' }, function appPriceLeftJoin() {
        this.on('new_app_price.app_id', '=', 'app_watcher.app_id')
          .andOn('new_app_price.currency_id', '=', dbCurrency.id);
      })
      .whereNull('new_app_price.id')
      .andWhere('app_watcher.watch_price', true)
      .andWhere('guild.id', message.guild.id);

    // Process missing app prices for new currency
    if (apps.length > 0) {
      const steamApps = await WebApi.GetAppPricesAsync(
        apps.map((app) => app.id),
        CURRENCIES[dbCurrency.abbreviation].cc,
      );

      const insert = [];

      for (let i = 0; i < apps.length; i += 1) {
        const app = apps[i];
        const steamApp = steamApps[app.id];

        if (!steamApp.success || !steamApp.data.price_overview) {
          return message.embed({
            color: EMBED_COLOURS.ERROR,
            description: insertEmoji(oneLine)`
              :ERROR: Unable to change currency,
              as the price watcher for **${app.name}**
              isn't available in **${dbCurrency.abbreviation}**!
            `,
          });
        }

        insert.push({
          appId: app.id,
          currencyId: dbCurrency.id,
          price: steamApp.data.price_overview.initial,
          discountedPrice: steamApp.data.price_overview.initial,
        });
      }

      await db.insert(insert).into('app_price');
    }

    await db('guild').update('currency_id', dbCurrency.id)
      .where('id', message.guild.id);

    return message.embed({
      color: EMBED_COLOURS.SUCCESS,
      description: insertEmoji`:SUCCESS: Currency set to **${dbCurrency.abbreviation}** (${dbCurrency.name}).`,
    });
  }
}
