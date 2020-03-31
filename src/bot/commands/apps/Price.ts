import { CommandMessage } from 'discord.js-commando';
import { DMChannel } from 'discord.js';
import SteamWatchClient from '../../structures/SteamWatchClient';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import db from '../../../db';
import WebApi from '../../../steam/WebApi';
import { EMBED_COLOURS } from '../../../utils/constants';

export default class PriceCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'price',
      group: 'apps',
      memberName: 'price',
      description: 'Fetch the currently cached price for the specified app.',
      examples: [
        'price 359550',
        'price 359550 GBP',
      ],
      argsPromptLimit: 0,
      args: [
        {
          key: 'appId',
          prompt: 'App identifier',
          type: 'app-id',
        },
        {
          key: 'currency',
          prompt: 'Currency',
          type: 'string',
          default: '',
        },
      ],
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async run(message: CommandMessage, { appId, currency }: { appId: number, currency: string }) {
    let selectedCurrency = currency.toUpperCase();

    if (!currency) {
      selectedCurrency = message.channel instanceof DMChannel
        ? 'USD'
        : await db.select('abbreviation')
          .from('currency')
          .innerJoin('guild', 'guild.currency_id', 'currency.id')
          .first()
          .then((result) => result.abbreviation);
    }

    const app = await db.select(
      'app.id',
      'app.name',
      'icon',
      'app_id',
      'formatted_price',
      'formatted_discounted_price',
      'discount',
    ).from('app_price')
      .innerJoin('app', 'app.id', 'app_price.app_id')
      .innerJoin('currency', 'currency.id', 'app_price.currency_id')
      .where({
        appId,
        abbreviation: selectedCurrency,
      })
      .first();

    if (!app) {
      return message.embed({
        color: EMBED_COLOURS.DEFAULT,
        description: 'No cached price found!',
      });
    }

    return message.embed({
      color: EMBED_COLOURS.DEFAULT,
      title: `**${app.name}**`,
      url: WebApi.getStoreUrl(app.id),
      timestamp: new Date(),
      thumbnail: {
        url: WebApi.getIconUrl(app.id, app.icon),
      },
      fields: [
        {
          name: 'Price',
          value: app.discount
            ? `~~${app.formattedPrice}~~\n**${app.formattedDiscountedPrice}**`
            : app.formattedPrice,
          inline: true,
        },
      ].concat(app.discount
        ? [{
          name: 'Discount',
          value: `-${app.discount}%`,
          inline: true,
        }]
        : []),
    });
  }
}
