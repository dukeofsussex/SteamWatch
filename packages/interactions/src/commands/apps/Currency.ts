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
  SteamAPI,
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

    let dbCurrency = await db.select<Currency>('currency.*')
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
    ctx.registerComponentFrom(
      ctx.messageID!,
      'currency_change',
      async () => {
        ctx.editOriginal({
          embeds,
          components: await CurrencyCommand.buildModifiedCurrencyComponents(page, placeholder),
        });
      },
      DEFAULT_COMPONENT_EXPIRATION,
      () => {
        ctx.editOriginal({ embeds, components: [] });
      },
    );

    // Cancel
    ctx.registerComponentFrom(
      ctx.messageID!,
      'currency_change_cancel',
      async () => {
        ctx.editOriginal({ embeds, components: [] });
      },
      DEFAULT_COMPONENT_EXPIRATION,
    );

    // Change currency select options
    ctx.registerComponentFrom(
      ctx.messageID!,
      'currency_select_change',
      async () => {
        page = page === 0 ? 1 : 0;
        ctx.editOriginal({
          embeds,
          components: await CurrencyCommand.buildModifiedCurrencyComponents(page, placeholder),
        });
      },
      DEFAULT_COMPONENT_EXPIRATION,
    );

    // Currency selected
    ctx.registerComponentFrom(
      ctx.messageID!,
      'currency_select',
      async (cctx: ComponentContext) => {
        const currencyId = parseInt(cctx.data.data.values![0]!, 10);

        dbCurrency = await db.select('*')
          .from('currency')
          .where('id', currencyId)
          .first() as Currency;

        // Fetch all apps that aren't already being tracked in the new currency
        const apps = await CurrencyCommand.fetchApps(dbCurrency.id.toString(), ctx.guildID!);

        // Process missing app prices for new currency
        if (apps.length > 0) {
          const invalidApps = await CurrencyCommand.processAppPrices(apps, dbCurrency);

          if (invalidApps.length > 0) {
            return ctx.error(stripIndents`
            Unable to change currency to **${dbCurrency.code}**.
            ${invalidApps.join('\n')}
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
    const components = await CurrencyCommand.buildCurrencyComponents(page);
    (components![0]!.components[0] as ComponentSelectMenu).placeholder = placeholder;
    return components;
  }

  private static fetchApps(currencyId: string, guildId: string) {
    return db.distinct('app.id', 'app.name')
      .from('guild')
      .innerJoin('channel_webhook', 'channel_webhook.guild_id', 'guild.id')
      .innerJoin('watcher', 'watcher.channel_id', 'channel_webhook.id')
      .innerJoin('app', 'app.id', 'watcher.app_id')
      .innerJoin({ currentAppPrice: 'app_price' }, (builder) => builder.on('current_app_price.app_id', 'watcher.app_id')
        .andOn('current_app_price.currency_id', 'guild.currency_id'))
      .leftJoin({ newAppPrice: 'app_price' }, (builder) => builder.on('new_app_price.app_id', 'watcher.app_id')
        .andOn('new_app_price.currency_id', currencyId))
      .whereNull('new_app_price.id')
      .andWhere('watcher.type', WatcherType.PRICE)
      .andWhere('guild.id', guildId);
  }

  private static async processAppPrices(apps: any[], currency: any) {
    const steamApps = await SteamAPI.getAppPrices(
      apps.map((app) => app.id),
      currency.countryCode,
    );

    const invalidApps = [];
    const insert = [];

    for (let i = 0; i < apps.length; i += 1) {
      const app = apps[i];
      const steamApp = steamApps?.[app.id];

      if (!steamApp?.success || !steamApp.data.price_overview) {
        invalidApps.push(oneLine`
          Price watcher for **${app.name}**
          isn't available in **${currency.code}**!
        `);
      } else {
        insert.push({
          appId: app.id,
          currencyId: currency.id,
          price: steamApp.data.price_overview.initial,
          discountedPrice: steamApp.data.price_overview.final,
          discount: steamApp.data.price_overview.discount_percent,
        });
      }
    }

    await db.insert(insert).into('app_price');

    return invalidApps;
  }
}
