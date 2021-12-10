import {
  CommandContext,
  CommandOptionType,
  SlashCommand,
  SlashCreator,
} from 'slash-create';
import db from '../../../db';
import { CurrencyCode } from '../../../db/knex';
import SteamUtil from '../../../steam/SteamUtil';
import { EMBED_COLOURS } from '../../../utils/constants';
import env from '../../../utils/env';

interface CommandArguments {
  query: string;
  currency?: string;
}

export default class PriceCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'price',
      description: 'Fetch the currently cached price for the specified app.',
      guildIDs: env.dev ? [env.devGuildId] : undefined,
      options: [{
        type: CommandOptionType.STRING,
        name: 'query',
        description: 'Search term or app id',
        required: true,
      }, {
        type: CommandOptionType.STRING,
        name: 'currency',
        description: 'The currency code to retrieve the price in',
      }],
    });

    this.filePath = __filename;
  }

  // eslint-disable-next-line class-methods-use-this
  async run(ctx: CommandContext) {
    await ctx.defer();
    const { query, currency } = ctx.options as CommandArguments;
    const appId = await SteamUtil.findAppId(query);

    if (!appId) {
      return ctx.error(`Unable to find an application with the id/name: ${query}`);
    }

    let code: CurrencyCode;

    if (!currency) {
      code = !ctx.guildID
        ? 'USD'
        : await db.select('code')
          .from('currency')
          .innerJoin('guild', 'guild.currency_id', 'currency.id')
          .first()
          .then((res: any) => res.code);
    } else {
      code = currency.toUpperCase() as CurrencyCode;
    }

    const app = await db.select(
      'app.id',
      'app.name',
      'icon',
      'app_id',
      'price',
      'discounted_price',
      'discount',
    ).from('app_price')
      .innerJoin('app', 'app.id', 'app_price.app_id')
      .innerJoin('currency', 'currency.id', 'app_price.currency_id')
      .where({
        appId,
        code,
      })
      .first();

    if (!app) {
      return ctx.embed({
        color: EMBED_COLOURS.DEFAULT,
        description: 'No cached price found!',
      });
    }

    return ctx.embed({
      color: EMBED_COLOURS.DEFAULT,
      title: `**${app.name}**`,
      url: SteamUtil.URLS.Store(app.id),
      timestamp: new Date(),
      thumbnail: {
        url: SteamUtil.URLS.Icon(app.id, app.icon),
      },
      fields: [
        {
          name: 'Price',
          value: SteamUtil.formatPriceDisplay({
            currency: code,
            discount: app.discount,
            final: app.discountedPrice,
            initial: app.price,
          }),
          inline: true,
        },
      ],
    });
  }
}
