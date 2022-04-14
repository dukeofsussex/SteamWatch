import { oneLine } from 'common-tags';
import {
  AutocompleteContext,
  CommandContext,
  CommandOptionType,
  SlashCommand,
  SlashCreator,
} from 'slash-create';
import db from '../../../db';
import { CurrencyCode } from '../../../db/knex';
import SteamAPI from '../../../steam/SteamAPI';
import SteamUtil from '../../../steam/SteamUtil';
import { MAX_OPTIONS, PERMITTED_APP_TYPES } from '../../../utils/constants';
import EmbedBuilder from '../../../utils/EmbedBuilder';
import env from '../../../utils/env';

interface CommandArguments {
  query: string;
  currency?: number;
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
        autocomplete: true,
        required: true,
      }, {
        type: CommandOptionType.NUMBER,
        name: 'currency',
        description: 'The currency to retrieve the price in',
        autocomplete: true,
      }],
    });

    this.filePath = __filename;
  }

  private static async createCurrencyAutocomplete(query: string) {
    const currencies = await db.select('*')
      .from('currency')
      .where('id', query)
      .orWhere('name', 'LIKE', `%${query}%`)
      .orWhere('code', 'LIKE', `${query}%`)
      .limit(MAX_OPTIONS);

    return currencies.map((currency) => ({
      name: oneLine`
        [${currency.code}]
        ${currency.name}
      `,
      value: currency.id.toString(),
    }));
  }

  // eslint-disable-next-line class-methods-use-this
  async autocomplete(ctx: AutocompleteContext) {
    const value = ctx.options[ctx.focused];

    if (ctx.focused === 'query') {
      return ctx.sendResults(await SteamUtil.createAppAutocomplete(value));
    }

    return ctx.sendResults(await PriceCommand.createCurrencyAutocomplete(value));
  }

  // eslint-disable-next-line class-methods-use-this
  async run(ctx: CommandContext) {
    await ctx.defer();
    const { query, currency } = ctx.options as CommandArguments;
    const appId = await SteamUtil.findAppId(query);

    if (!appId) {
      return ctx.error(`Unable to find an application id for: ${query}`);
    }

    const app = (await db.select('*')
      .from('app')
      .where('id', appId)
      .first()) || (await SteamUtil.persistApp(appId));

    if (!app) {
      return ctx.error(`Unable to find an application with the id/name: ${query}`);
    }

    if (!PERMITTED_APP_TYPES.price.includes(app.type.toLowerCase())) {
      return ctx.error(`Unable to fetch prices for apps of type **${app.type}**!`);
    }

    let currencyDetails: { code: CurrencyCode, countryCode: string } = { code: 'USD', countryCode: 'US' };

    if (currency || ctx.guildID) {
      let dbQuery = db.select('code', 'countryCode')
        .from('currency');

      if (currency) {
        dbQuery = dbQuery.where('currency.id', currency);
      } else {
        dbQuery = dbQuery.innerJoin('guild', 'guild.currency_id', 'currency.id')
          .where('guild.id', ctx.guildID);
      }

      currencyDetails = await dbQuery.first() as any;
    }

    const prices = await SteamAPI.getAppPrices([appId], currencyDetails.countryCode);

    if (!prices || !prices[appId].success || Array.isArray(prices[app.id].data)) {
      return ctx.embed({
        ...EmbedBuilder.createApp(app, {
          description: (!prices || !prices[appId].success)
            ? 'No price found!'
            : '**Free**',
          timestamp: new Date(),
          title: app.name,
          url: SteamUtil.URLS.Store(appId),
        }),
        fields: [{
          name: 'Steam Client Link',
          value: SteamUtil.BP.Store(appId),
        }],
      });
    }

    return ctx.embed(
      EmbedBuilder.createPrice(app, currencyDetails.code, prices[appId].data.price_overview!),
    );
  }
}
