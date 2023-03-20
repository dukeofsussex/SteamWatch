import {
  AutocompleteContext,
  CommandContext,
  SlashCommand,
  SlashCreator,
} from 'slash-create';
import {
  AppType,
  CurrencyCode,
  db,
  EmbedBuilder,
  env,
  MAX_OPTIONS,
  PriceType,
  SteamUtil,
  StoreItem,
  WatcherType,
} from '@steamwatch/shared';
import CommonCommandOptions from '../../CommonCommandOptions';

interface CommandArguments {
  app: string;
  currency?: number;
}

export default class PriceCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'price',
      description: 'Fetch the current price for the specified app.',
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
      options: [
        CommonCommandOptions.App,
        CommonCommandOptions.Currency,
      ],
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
      name: `[${currency.code}] ${currency.name}`,
      value: currency.id,
    }));
  }

  // eslint-disable-next-line class-methods-use-this
  override async autocomplete(ctx: AutocompleteContext) {
    const value = ctx.options[ctx.focused];

    if (ctx.focused === 'app') {
      return ctx.sendResults(await SteamUtil.createAppAutocomplete(value));
    }

    return ctx.sendResults(await PriceCommand.createCurrencyAutocomplete(value));
  }

  // eslint-disable-next-line class-methods-use-this
  override async run(ctx: CommandContext) {
    await ctx.defer();
    const { app: query, currency } = ctx.options as CommandArguments;
    const { id, type } = await SteamUtil.findStoreItem(query);

    if (!id) {
      return ctx.error(`Unable to find a store page for: ${query}`);
    }

    let item: StoreItem | null;

    if (type === PriceType.Bundle) {
      item = (await db.select('id', 'name', '"bundle" AS type')
        .from('bundle')
        .where('id', id)
        .first()) || (await SteamUtil.persistBundle(id));
    } else if (type === PriceType.Sub) {
      item = (await db.select('id', 'name', '"sub" AS type')
        .from('sub')
        .where('id', id)
        .first()) || (await SteamUtil.persistSub(id));
    } else {
      if (!SteamUtil.canHaveWatcher(type as AppType, WatcherType.Price)) {
        return ctx.error(`Unable to fetch prices for apps of type **${type}**!`);
      }

      item = (await db.select('id', 'name', 'icon', 'type')
        .from('app')
        .where('id', id)
        .first()) || (await SteamUtil.persistApp(id));
    }

    if (!item?.id) {
      return ctx.error(`Unable to find a Store item with the id **${id}**!`);
    }

    // New bundles and subs don't have an assigned type property
    item.type = type;

    let currencyDetails: { code: CurrencyCode, countryCode: string } = {
      code: 'USD',
      countryCode: 'US',
    };

    if (currency || ctx.guildID) {
      let dbQuery = db.select('code', 'countryCode')
        .from('currency');

      if (currency) {
        dbQuery = dbQuery.where('currency.id', currency);
      } else {
        dbQuery = dbQuery.innerJoin('guild', 'guild.currency_id', 'currency.id')
          .where('guild.id', ctx.guildID);
      }

      const details = await dbQuery.first();
      currencyDetails = details || currencyDetails;
    }

    const storePrices = await SteamUtil.getStorePrices(
      [id],
      type,
      currencyDetails.code,
      currencyDetails.countryCode,
    );

    let message: string;

    if (!storePrices[item.id]) {
      message = 'No price found!';
    } else if (storePrices[item.id]!.final === 0) {
      message = '**Free**';
    } else {
      message = SteamUtil.formatPriceDisplay({
        currency: currencyDetails.code,
        ...storePrices[item.id]!,
      });
    }

    return ctx.embed(EmbedBuilder.createStoreItem(item, message));
  }
}
