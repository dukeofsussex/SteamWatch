import { oneLine, stripIndents } from 'common-tags';
import { CommandMessage } from 'discord.js-commando';
import SteamWatchClient from '../../structures/SteamWatchClient';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import db from '../../../db';
import WebApi from '../../../steam/WebApi';
import { EMBED_COLOURS } from '../../../utils/constants';
import { insertEmoji } from '../../../utils/templateTags';

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
        'currency GBP',
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
          ${dbCurrency.flag}
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
    const apps = await CurrencyCommand.fetchAppsAsync(dbCurrency.id, message.guild.id);

    // Process missing app prices for new currency
    if (apps.length > 0) {
      const invalidApps = await CurrencyCommand.processAppPricesAsync(apps, currency);

      if (invalidApps.length > 0) {
        return message.embed({
          color: EMBED_COLOURS.ERROR,
          description: insertEmoji(stripIndents)`
            :ERROR: Unable to change currency to **${dbCurrency.abbreviation}**.
            ${invalidApps.join('\n')}
          `,
        });
      }
    }

    await db('guild').update('currency_id', dbCurrency.id)
      .where('id', message.guild.id);

    return message.embed({
      color: EMBED_COLOURS.SUCCESS,
      description: insertEmoji`
        :SUCCESS: Currency set to **${dbCurrency.abbreviation}** (${dbCurrency.name}).
      `,
    });
  }

  private static fetchAppsAsync(currencyId: string, guildId: string) {
    return db.select('app.id', 'app.name')
      .from('guild')
      .innerJoin('app_watcher', 'app_watcher.guild_id', 'guild.id')
      .innerJoin('app', 'app.id', 'app_watcher.app_id')
      .innerJoin({ currentAppPrice: 'app_price' }, function appPriceInnerJoin() {
        this.on('current_app_price.app_id', '=', 'app_watcher.app_id')
          .andOn('current_app_price.currency_id', '=', 'guild.currency_id');
      })
      .leftJoin({ newAppPrice: 'app_price' }, function appPriceLeftJoin() {
        this.on('new_app_price.app_id', '=', 'app_watcher.app_id')
          .andOn('new_app_price.currency_id', '=', currencyId);
      })
      .whereNull('new_app_price.id')
      .andWhere('app_watcher.watch_price', true)
      .andWhere('guild.id', guildId);
  }

  private static async processAppPricesAsync(apps: any[], currency: any) {
    const steamApps = await WebApi.getAppPricesAsync(
      apps.map((app) => app.id),
      currency.countryCode,
    );

    const invalidApps = [];
    const insert = [];

    for (let i = 0; i < apps.length; i += 1) {
      const app = apps[i];
      const steamApp = steamApps[app.id];

      if (!steamApp.success || !steamApp.data.price_overview) {
        invalidApps.push(oneLine`
          Price watcher for **${app.name}**
          isn't available in **${currency.abbreviation}**!
        `);
      } else {
        insert.push({
          appId: app.id,
          currencyId: currency.id,
          price: steamApp.data.price_overview.initial,
          formattedPrice: steamApp.data.price_overview.initial_formatted
            || steamApp.data.price_overview.final_formatted,
          discountedPrice: steamApp.data.price_overview.final,
          formattedDiscountedPrice: steamApp.data.price_overview.final_formatted,
          discount: steamApp.data.price_overview.discount_percent,
        });
      }
    }

    await db.insert(insert).into('app_price');

    return invalidApps;
  }
}
