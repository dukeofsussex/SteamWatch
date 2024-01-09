import {
  AutocompleteContext,
  CommandContext,
  CommandOptionType,
  SlashCommand,
  SlashCreator,
} from 'slash-create';
import { ECurrencyCode } from 'steam-user';
import {
  capitalize,
  db,
  EMBED_COLOURS,
  env,
  SteamAPI,
  SteamUtil,
} from '@steamwatch/shared';
import CommonCommandOptions from '../../CommonCommandOptions';
import GuildOnlyCommand from '../../GuildOnlyCommand';

interface CommandArguments {
  item: string;
  currency?: number;
}

export default class MarketCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'market',
      description: 'Fetch details for the specified market item.',
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'item',
          description: 'Item name or url',
          // autocomplete: true, // Disabled due to strict rate limits
          required: true,
        },
        CommonCommandOptions.Currency,
      ],
      throttling: {
        duration: env.dev ? 1 : 60,
        usages: 1,
      },
    });

    this.filePath = __filename;
  }

  // eslint-disable-next-line class-methods-use-this
  override async autocomplete(ctx: AutocompleteContext) {
    const value = ctx.options[ctx.focused];

    if (ctx.focused === 'item') {
      return ctx.sendResults(await MarketCommand.createItemAutocomplete(value));
    }

    return ctx.sendResults(await GuildOnlyCommand.createCurrencyAutocomplete(value));
  }

  // eslint-disable-next-line class-methods-use-this
  override async run(ctx: CommandContext) {
    await ctx.defer();
    const { item, currency } = ctx.options as CommandArguments;

    let appId = 0;
    let term = item;
    const parts = item.split('/');
    const urlMatch = item.match(SteamUtil.REGEXPS.MarketListing);

    if (parts.length === 2) {
      appId = parseInt(parts[1]!, 10);
      term = parts[2]!;
    } else if (urlMatch) {
      appId = parseInt(urlMatch[1]!, 10);
      term = urlMatch[2]!;
    }

    const asset = (await SteamAPI.searchMarket(term, appId))?.[0];

    if (!asset) {
      return ctx.error('Unable to find the market asset');
    }

    appId = asset.asset_description.appid;

    let cc: number = ECurrencyCode.USD;

    if (currency || ctx.guildID) {
      let dbQuery = db.select('code')
        .from('currency');

      if (currency) {
        dbQuery = dbQuery.where('currency.id', currency);
      } else {
        dbQuery = dbQuery.innerJoin('guild', 'guild.currency_id', 'currency.id')
          .where('guild.id', ctx.guildID);
      }

      const dbCode = await dbQuery.first();
      cc = ECurrencyCode[dbCode?.code as keyof typeof ECurrencyCode ?? 'USD'] || cc;
    }

    const priceOverview = await SteamAPI.getMarketListingPriceOverview(
      asset.asset_description.appid,
      asset.asset_description.market_hash_name,
      cc,
    );

    if (!priceOverview) {
      return ctx.error('Unable to fetch prices for the market asset');
    }

    return ctx.embed({
      title: asset.asset_description.market_name,
      color: parseInt(asset.asset_description.name_color, 16) || EMBED_COLOURS.INACTIVE,
      timestamp: new Date(),
      footer: {
        text: asset.app_name,
        icon_url: asset.app_icon,
      },
      thumbnail: {
        url: SteamUtil.URLS.MarketListingIcon(asset.asset_description.icon_url),
      },
      url: SteamUtil.URLS.MarketListing(
        asset.asset_description.appid,
        asset.asset_description.market_hash_name,
      ),
      fields: [{
        name: 'Listings',
        value: `${asset.sell_listings}`,
        inline: true,
      }, {
        name: 'Commodity',
        value: capitalize(`${!!asset.asset_description.commodity}`),
        inline: true,
      }, {
        name: 'Type',
        value: asset.asset_description.type,
        inline: true,
      },
      ...(priceOverview.median_price ? [{
        name: 'Median Price',
        value: priceOverview.median_price,
        inline: true,
      }] : []),
      {
        name: 'Lowest Price',
        value: priceOverview?.lowest_price,
        inline: true,
      }, {
        name: 'Steam Client Link',
        value: SteamUtil.BP.MarketListing(
          asset.asset_description.appid,
          asset.asset_description.market_hash_name,
        ),
      }],
    });
  }

  private static async createItemAutocomplete(item: string) {
    if (!item.trim().length) {
      return [];
    }

    const items = await SteamAPI.searchMarket(item);

    return items?.map((i) => ({
      name: `[${i.app_name || 'N/A'}] ${i.asset_description.market_name}`,
      value: `${i.asset_description.appid}/${i.asset_description.market_hash_name}`,
    })) ?? [];
  }
}
