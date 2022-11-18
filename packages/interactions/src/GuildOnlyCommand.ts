import { oneLine } from 'common-tags';
import { Routes, RESTGetAPIGuildResult } from 'discord-api-types/v9';
import {
  ButtonStyle,
  CommandContext,
  ComponentActionRow,
  ComponentContext,
  ComponentType,
  SlashCommand,
} from 'slash-create';
import {
  capitalize,
  db,
  EMBED_COLOURS,
  EMOJIS,
  DiscordAPI,
  DiscordUtil,
  logger,
  MAX_OPTIONS,
} from '@steamwatch/shared';

export default class GuildOnlyCommand extends SlashCommand {
  override hasPermission(ctx: CommandContext) {
    return typeof ctx.guildID !== 'undefined' && super.hasPermission(ctx);
  }

  protected static async buildCurrencyComponents(page: number): Promise<ComponentActionRow[]> {
    const currencies = await db.select('*')
      .from('currency')
      .limit(MAX_OPTIONS)
      .offset(page * MAX_OPTIONS)
      .orderBy('name', 'asc');

    return [{
      type: ComponentType.ACTION_ROW,
      components: [{
        custom_id: 'currency_select',
        placeholder: 'Select your currency',
        type: ComponentType.SELECT,
        options: currencies.map(({
          id, name, code, countryCode,
        }) => ({
          label: `[${code}] ${name}`,
          value: id.toString(),
          emoji: { name: DiscordUtil.getFlagEmoji(countryCode) },
        })),
      }],
    }, {
      type: ComponentType.ACTION_ROW,
      components: [{
        type: ComponentType.BUTTON,
        custom_id: 'currency_select_change',
        label: 'View more currencies',
        style: ButtonStyle.PRIMARY,
      }],
    }];
  }

  protected static async createWatcherAutocomplete(value: string, guildId: string) {
    const dbWatcher = await db.select({ appName: 'app.name' }, { ugcName: 'ugc.name' }, 'watcher.*')
      .from('app')
      .innerJoin('watcher', 'app.id', 'watcher.app_id')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
      .leftJoin('ugc', 'ugc.id', 'watcher.ugc_id')
      .where('guild_id', guildId)
      .andWhere((builder) => builder.where('watcher.id', value)
        .orWhere('app.name', 'LIKE', `${value}%`)
        .orWhere('ugc.name', 'LIKE', `${value}%`))
      .limit(MAX_OPTIONS);

    return Promise.all(dbWatcher.map(async (w) => ({
      name: oneLine`
        [ID: ${w.id}]
        ${w.ugcName ? `${w.ugcName} (${w.appName})` : w.appName}
        (${capitalize(w.type)})
        on
        #${(await DiscordAPI.getChannelName(w.channelId))}
      `,
      value: w.id,
    })));
  }

  /**
   * @returns Boolean indicating whether the guild needed to be set up.
   */
  protected static async setupGuild(ctx: CommandContext) {
    await ctx.defer();

    const exists = await db.select('id')
      .from('guild')
      .where('id', ctx.guildID)
      .first()
      .then((res: any) => !!res);

    if (exists) {
      return false;
    }

    let page = 0;
    const embeds = [{
      color: EMBED_COLOURS.PENDING,
      description: `${EMOJIS.ALERT} Please select your preferred currency for app prices`,
    }];

    await ctx.send({
      embeds,
      components: await GuildOnlyCommand.buildCurrencyComponents(page),
    });

    return new Promise<boolean>((resolve) => {
      // Change currency select options
      ctx.registerComponent('currency_select_change', async () => {
        page = page === 0 ? 1 : 0;
        ctx.editOriginal({
          embeds,
          components: await GuildOnlyCommand.buildCurrencyComponents(page),
        });
      });

      // Finish guild setup
      ctx.registerComponent('currency_select', async (cctx: ComponentContext) => {
        await cctx.editOriginal({
          embeds: [{
            color: EMBED_COLOURS.SUCCESS,
            description: `${EMOJIS.SUCCESS} Guild ready!`,
          }],
          components: [],
        });

        const guild = await DiscordAPI.get(Routes.guild(ctx.guildID!), {
          query: new URLSearchParams([['with_counts', 'true']]),
        }) as RESTGetAPIGuildResult;

        await db.insert({
          id: ctx.guildID!,
          name: guild.name,
          currencyId: cctx.data.data.values![0],
        }).into('guild');

        logger.info({
          group: 'Interaction',
          message: 'Set up new guild!',
        });

        resolve(true);
      });
    });
  }
}
