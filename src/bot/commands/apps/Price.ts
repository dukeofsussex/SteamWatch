import { CommandMessage } from 'discord.js-commando';
import db from '../../../db';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import SteamWatchClient from '../../structures/SteamWatchClient';
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
          default: 'USD',
        },
      ],
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async run(message: CommandMessage, { appid, currency }: { appid: number, currency: string }) {
    const price = await db.select(
      'name',
      'icon',
      'app_id',
      'formatted_price',
      'formatted_discounted_price',
      'discount',
    ).from('app_price')
      .innerJoin('app', 'app.id', 'app_price.app_id')
      .innerJoin('currency', 'currency.id', 'app_price.currency_id')
      .where({
        appid,
        abbreviation: currency.toUpperCase(),
      })
      .first();

    if (!price) {
      return message.embed({
        color: EMBED_COLOURS.DEFAULT,
        description: 'No cached price found!',
      });
    }

    return message.embed({
      color: EMBED_COLOURS.DEFAULT,
      title: `**${price.name}**`,
      footer: {
        text: price.name,
      },
      url: WebApi.GetStoreUrl(price.appId),
      timestamp: new Date(),
      thumbnail: {
        url: WebApi.GetIconUrl(price.appId, price.icon),
      },
      fields: [
        {
          name: 'Price',
          value: price.discount
            ? `~~${price.formattedPrice}~~\n**${price.formattedDiscountPrice}**`
            : price.formattedPrice,
          inline: true,
        },
      ].concat(price.discount
        ? [{
          name: 'Discount',
          value: `-${price.discount}%`,
          inline: true,
        }]
        : []),
    });
  }
}
