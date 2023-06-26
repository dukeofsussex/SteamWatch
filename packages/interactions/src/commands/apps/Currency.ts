import { oneLine, stripIndents } from 'common-tags';
import { RESTGetAPIGuildResult, Routes } from 'discord-api-types/v10';
import type { AutocompleteContext, CommandContext, SlashCreator } from 'slash-create';
import {
  Currency,
  db,
  DiscordAPI,
  DiscordUtil,
  EMBED_COLOURS,
  env,
  logger,
  PriceType,
  SteamUtil,
  WatcherType,
} from '@steamwatch/shared';
import CommonCommandOptions from '../../CommonCommandOptions';
import GuildOnlyCommand from '../../GuildOnlyCommand';

interface CommandArguments {
  currency?: number;
}

export default class CurrencyCommand extends GuildOnlyCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'currency',
      description: 'Manage the preferred app currency for the guild.',
      dmPermission: false,
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
      options: [
        {
          ...CommonCommandOptions.Currency,
          description: 'New currency',
        },
      ],
      requiredPermissions: ['MANAGE_CHANNELS'],
    });

    this.filePath = __filename;
  }

  // eslint-disable-next-line class-methods-use-this
  override async autocomplete(ctx: AutocompleteContext) {
    const value = ctx.options[ctx.focused];

    return ctx.sendResults(await GuildOnlyCommand.createCurrencyAutocomplete(value));
  }

  // eslint-disable-next-line class-methods-use-this
  override async run(ctx: CommandContext) {
    await ctx.defer();

    const { currency } = ctx.options as CommandArguments;

    if (!currency) {
      const dbCurrency = await db.select('currency.*')
        .from('guild')
        .innerJoin('currency', 'currency.id', 'guild.currency_id')
        .where('guild.id', ctx.guildID)
        .first();

      return dbCurrency
        ? ctx.embed({
          color: EMBED_COLOURS.DEFAULT,
          description: `Currency: ${DiscordUtil.getFlagEmoji(dbCurrency.countryCode)} [${dbCurrency.code}] ${dbCurrency.name}`,
        })
        : ctx.error('Currency has not yet been set!');
    }

    const dbCurrency = await db.select('*')
      .from('currency')
      .where('id', currency)
      .first() as Currency;

    if (!dbCurrency) {
      return ctx.error('Invalid currency identifier!');
    }

    if (!await GuildOnlyCommand.isGuildSetUp(ctx)) {
      const guild = await DiscordAPI.get(Routes.guild(ctx.guildID!)) as RESTGetAPIGuildResult;

      await db.insert({
        id: ctx.guildID!,
        name: guild.name,
        currencyId: currency,
      }).into('guild');

      logger.info({
        message: 'New guild set up',
        guild,
      });
    } else if (currency !== dbCurrency.id) {
      // Fetch all apps that aren't already being tracked in the new currency
      const prices = await CurrencyCommand.fetchUntrackedPrices(dbCurrency.id, ctx.guildID!);

      // Process missing app prices for new currency
      if (prices.length) {
        const invalid = await CurrencyCommand.processPrices(prices, dbCurrency);

        if (invalid.length) {
          return ctx.error(stripIndents`
           Unable to change currency to **${dbCurrency.code}**.
           ${invalid.join('\n')}
         `);
        }
      }

      await db('guild').update('currency_id', currency)
        .where('id', ctx.guildID);
    }

    return ctx.success(`Currency set to ${DiscordUtil.getFlagEmoji(dbCurrency.countryCode)} [${dbCurrency.code}] ${dbCurrency.name}.`);
  }

  private static fetchUntrackedPrices(currencyId: number, guildId: string) {
    return db.distinct(
      db.raw(oneLine`
        CASE
          WHEN watcher.bundle_id IS NOT NULL THEN bundle.id
          WHEN watcher.sub_id IS NOT NULL THEN sub.id
          ELSE app.id
        END AS id
      `),
      db.raw(oneLine`
        CASE
          WHEN watcher.bundle_id IS NOT NULL THEN bundle.name
          WHEN watcher.sub_id IS NOT NULL THEN sub.name
          ELSE app.name
        END AS name
      `),
      db.raw(oneLine`
        CASE
          WHEN watcher.bundle_id IS NOT NULL THEN "bundle"
          WHEN watcher.sub_id IS NOT NULL THEN "sub"
          ELSE "app"
        END AS type
      `),
    )
      .from('guild')
      .innerJoin('channel_webhook', 'channel_webhook.guild_id', 'guild.id')
      .innerJoin('watcher', 'watcher.channel_id', 'channel_webhook.id')
      .leftJoin('app', 'app.id', 'watcher.app_id')
      .leftJoin('bundle', 'bundle.id', 'watcher.bundle_id')
      .leftJoin('sub', 'sub.id', 'watcher.sub_id')
      .innerJoin(
        { currentPrice: 'price' },
        (builder) => builder.on(
          (innerBuilder) => innerBuilder.on('currentPrice.app_id', 'watcher.app_id')
            .orOn('currentPrice.bundle_id', 'watcher.bundle_id')
            .orOn('currentPrice.sub_id', 'watcher.sub_id'),
        ).andOn('currentPrice.currency_id', 'guild.currency_id'),
      )
      .leftJoin(
        { newPrice: 'price' },
        (builder) => builder.on(
          (innerBuilder) => innerBuilder.on('newPrice.app_id', 'watcher.app_id')
            .orOn('newPrice.bundle_id', 'watcher.bundle_id')
            .orOn('newPrice.sub_id', 'watcher.sub_id'),
        ).andOn('newPrice.currency_id', currencyId.toString()),
      )
      .whereNull('newPrice.id')
      .andWhere('watcher.type', WatcherType.Price)
      .andWhere('guild.id', guildId);
  }

  private static async processPrices(prices: any[], currency: Currency) {
    const groupedPrices = prices.reduce((group, price) => {
      if (!group[price.type]) {
        // eslint-disable-next-line no-param-reassign
        group[price.type] = [];
      }

      group[price.type].push(price);

      return group;
    }, {});

    const types = Object.keys(groupedPrices);

    const invalid = [];
    const insert = [];

    for (let i = 0; i < types.length; i += 1) {
      const type = types[i]! as PriceType;

      // eslint-disable-next-line no-await-in-loop
      const storePrices = await SteamUtil.getStorePrices(
        groupedPrices[type].map((p: any) => p.id),
        type,
        currency.code,
        currency.countryCode,
      );

      for (let j = 0; j < groupedPrices[type]!.length; j += 1) {
        const price = groupedPrices[type][j];
        const storePrice = storePrices[price.id];

        if (!storePrice) {
          invalid.push(oneLine`
            Price watcher for **${price.name}**
            isn't available in **${currency.code}**!
          `);
        } else {
          insert.push({
            appId: type === PriceType.App ? price.id : null,
            bundleId: type === PriceType.Bundle ? price.id : null,
            subId: type === PriceType.Sub ? price.id : null,
            currencyId: currency.id,
            price: storePrice.initial,
            discountedPrice: storePrice.final,
            discount: storePrice.discount,
            lastChecked: new Date(),
            lastUpdate: new Date(),
          });
        }
      }
    }

    if (insert.length) {
      await db.insert(insert).into('price');
    }

    return invalid;
  }
}
