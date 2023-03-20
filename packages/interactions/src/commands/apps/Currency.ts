import { oneLine, stripIndents } from 'common-tags';
import {
  ButtonStyle,
  CommandContext,
  ComponentContext,
  ComponentSelectMenu,
  ComponentType,
  SlashCreator,
} from 'slash-create';
import {
  Currency,
  db,
  DEFAULT_COMPONENT_EXPIRATION,
  DiscordUtil,
  EMBED_COLOURS,
  env,
  PriceType,
  SteamUtil,
  WatcherType,
} from '@steamwatch/shared';
import GuildOnlyCommand from '../../GuildOnlyCommand';

export default class CurrencyCommand extends GuildOnlyCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'currency',
      description: 'Manage the preferred app currency for the guild.',
      dmPermission: false,
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
      requiredPermissions: ['MANAGE_CHANNELS'],
    });

    this.filePath = __filename;
  }

  override async run(ctx: CommandContext) {
    try {
      const setup = await this.setupGuild(ctx);

      // Just selected a currency, no need to do it a second time
      if (setup) {
        return;
      }
    } catch {
      return;
    }

    let page = 0;

    let dbCurrency = await db.select('currency.*')
      .from('guild')
      .innerJoin('currency', 'currency.id', 'guild.currency_id')
      .where('guild.id', ctx.guildID)
      .first() as Currency;

    const placeholder = `[${dbCurrency.code}] ${dbCurrency.name}`;
    const embeds = [{
      color: EMBED_COLOURS.DEFAULT,
      description: `Current currency: ${DiscordUtil.getFlagEmoji(dbCurrency.countryCode)} [${dbCurrency.code}] ${dbCurrency.name}`,
    }];

    await ctx.send({
      embeds,
      components: [{
        type: ComponentType.ACTION_ROW,
        components: [{
          custom_id: 'currency_change',
          label: 'Change currency',
          style: ButtonStyle.PRIMARY,
          type: ComponentType.BUTTON,
        }, {
          custom_id: 'currency_change_cancel',
          label: 'Cancel',
          type: ComponentType.BUTTON,
          style: ButtonStyle.SECONDARY,
        }],
      }],
    });

    // Change currency
    ctx.registerComponent(
      'currency_change',
      async (cctx) => cctx.editParent({
        embeds,
        components: await CurrencyCommand.buildModifiedCurrencyComponents(page, placeholder),
      }),
      DEFAULT_COMPONENT_EXPIRATION,
      () => {
        try {
          ctx.editOriginal({ embeds, components: [] });
        } catch {
          // Interaction may have already been deleted by the user
          // or expired before being able to send this message
        }
      },
    );

    // Cancel
    ctx.registerComponent(
      'currency_change_cancel',
      async (cctx) => cctx.editParent({ embeds, components: [] }),
      DEFAULT_COMPONENT_EXPIRATION,
    );

    // Change currency select options
    ctx.registerComponent(
      'currency_select_change',
      async (cctx) => {
        page = page === 0 ? 1 : 0;
        return cctx.editParent({
          embeds,
          components: await CurrencyCommand.buildModifiedCurrencyComponents(page, placeholder),
        });
      },
      DEFAULT_COMPONENT_EXPIRATION,
    );

    // Currency selected
    ctx.registerComponent(
      'currency_select',
      async (cctx: ComponentContext) => {
        const currencyId = parseInt(cctx.data.data.values![0]!, 10);

        dbCurrency = await db.select('*')
          .from('currency')
          .where('id', currencyId)
          .first() as Currency;

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

        await db('guild').update('currency_id', currencyId)
          .where('id', ctx.guildID);

        return ctx.success(`Currency set to ${DiscordUtil.getFlagEmoji(dbCurrency.countryCode)} [${dbCurrency.code}] ${dbCurrency.name}.`);
      },
      DEFAULT_COMPONENT_EXPIRATION,
    );
  }

  private static async buildModifiedCurrencyComponents(page: number, placeholder: string) {
    const components = await GuildOnlyCommand.buildCurrencyComponents(page);
    (components![0]!.components[0] as ComponentSelectMenu).placeholder = placeholder;
    return components;
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

  private static async processPrices(prices: any[], currency: any) {
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
