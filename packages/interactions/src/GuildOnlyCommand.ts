import { oneLine } from 'common-tags';
import { Routes, RESTGetAPIGuildResult, RESTGetAPIGuildThreadsResult } from 'discord-api-types/v10';
import {
  ButtonStyle,
  CommandContext,
  ComponentActionRow,
  ComponentContext,
  ComponentType,
  SlashCommand,
} from 'slash-create';
import {
  db,
  DEFAULT_COMPONENT_EXPIRATION,
  DiscordAPI,
  DiscordUtil,
  EMBED_COLOURS,
  EMOJIS,
  EPublishedFileInfoMatchingFileType as EPFIMFileType,
  logger,
  MAX_OPTIONS,
  WatcherType,
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
        type: ComponentType.STRING_SELECT,
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

  protected static async createThreadAutocomplete(value: string, guildId: string) {
    const guildThreads = await DiscordAPI.get(
      Routes.guildActiveThreads(guildId),
    ) as RESTGetAPIGuildThreadsResult;

    return guildThreads.threads.filter(
      (thread) => thread.id.includes(value) || thread.name?.includes(value),
    ).map((thread) => ({
      name: thread.name || 'N/A',
      value: thread.id,
    }));
  }

  protected static async createWatcherAutocomplete(value: string, guildId: string) {
    const dbWatcher = await db.select('app.name', 'null AS filetype', 'watcher.*')
      .from('watcher')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
      .innerJoin('app', 'app.id', 'watcher.app_id')
      .where('guild_id', guildId)
      .andWhere((builder) => (value
        ? builder.where('watcher.id', value)
          .orWhere('watcher.type', 'LIKE', `${value}%`)
          .orWhere('app.name', 'LIKE', `${value}%`)
        : builder))
      .union(
        db.select('app.name', 'app_workshop.filetype', 'watcher.*')
          .from('watcher')
          .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
          .innerJoin('app_workshop', 'app_workshop.id', 'watcher.workshop_id')
          .innerJoin('app', 'app.id', 'app_workshop.app_id')
          .where('guild_id', guildId)
          .andWhere((builder) => (value
            ? builder.where('watcher.id', value)
              .orWhere('watcher.type', 'LIKE', `${value}%`)
              .orWhere('app.name', 'LIKE', `${value}%`)
              .orWhere('app_workshop.filetype', 'LIKE', `${value}%`)
            : builder)),
        db.select(db.raw('CONCAT(forum.name, \' (\', IF(forum.app_id IS NOT NULL, app.name, `group`.name), \')\') AS name'), 'null AS filetype', 'watcher.*')
          .from('watcher')
          .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
          .innerJoin('forum', 'forum.id', 'watcher.forum_id')
          .leftJoin('app', 'app.id', 'forum.app_id')
          .leftJoin('`group`', '`group`.id', 'forum.group_id')
          .where('guild_id', guildId)
          .andWhere((builder) => (value
            ? builder.where('watcher.id', value)
              .orWhere('watcher.type', 'LIKE', `${value}%`)
              .orWhere('app.name', 'LIKE', `${value}%`)
              .orWhere('`group`.name', 'LIKE', `${value}%`)
              .orWhere('forum.name', 'LIKE', `${value}%`)
            : builder)),
        db.select(db.raw('"Free Promotions" AS name'), 'null AS filetype', 'watcher.*')
          .from('watcher')
          .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
          .where('guild_id', guildId)
          .andWhere('watcher.type', WatcherType.Free)
          .andWhere((builder) => (value
            ? builder.where('watcher.id', value)
              .orWhere('watcher.type', 'LIKE', `${value}%`)
            : builder)),
        db.select('`group`.name', 'null AS filetype', 'watcher.*')
          .from('watcher')
          .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
          .innerJoin('`group`', '`group`.id', 'watcher.group_id')
          .where('guild_id', guildId)
          .andWhere((builder) => (value
            ? builder.where('watcher.id', value)
              .orWhere('watcher.type', 'LIKE', `${value}%`)
              .orWhere('`group`.name', 'LIKE', `${value}%`)
              .orWhere('`group`.vanity_url', 'LIKE', `${value}%`)
            : builder)),
        db.select(db.raw('CONCAT(ugc.name, \' (\', app.name, \')\') AS name'), 'null AS filetype', 'watcher.*')
          .from('watcher')
          .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
          .innerJoin('ugc', 'ugc.id', 'watcher.ugc_id')
          .innerJoin('app', 'app.id', 'ugc.app_id')
          .where('guild_id', guildId)
          .andWhere((builder) => (value
            ? builder.where('watcher.id', value)
              .orWhere('watcher.type', 'LIKE', `${value}%`)
              .orWhere('app.name', 'LIKE', `${value}%`)
              .orWhere('ugc.name', 'LIKE', `${value}%`)
            : builder)),
      )
      .orderBy('id')
      .limit(MAX_OPTIONS);

    const channelIds = [...new Set(dbWatcher.map((w) => w.channelId))];
    const channelNames = await Promise.all(channelIds.map((c) => DiscordAPI.getChannelName(c)));

    return Promise.all(dbWatcher.map(async (w) => ({
      name: oneLine`
        [ID: ${w.id}]
        ${w.name}
        (${oneLine`
          ${w.type}
          ${(w.workshopId ? `(${EPFIMFileType[w.filetype]})` : '')}
        `})
        on
        #${channelNames[channelIds.indexOf(w.channelId)]}
      `,
      value: w.id,
    })));
  }

  /**
   * @returns Boolean indicating whether the guild needed to be set up.
   */
  protected async setupGuild(ctx: CommandContext) {
    await ctx.defer(this.deferEphemeral);

    const exists = await db.select('id')
      .from('guild')
      .whereNotNull('currencyId')
      .andWhere('id', ctx.guildID)
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

    return new Promise<boolean>((resolve, reject) => {
      // Change currency select options
      ctx.registerComponent(
        'currency_select_change',
        async () => {
          page = page === 0 ? 1 : 0;
          ctx.editOriginal({
            embeds,
            components: await GuildOnlyCommand.buildCurrencyComponents(page),
          });
        },
        DEFAULT_COMPONENT_EXPIRATION,
      );

      // Finish guild setup
      ctx.registerComponent(
        'currency_select',
        async (cctx: ComponentContext) => {
          ctx.unregisterComponent('currency_select');

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
          }).into('guild')
            .onConflict('id')
            .merge(['currencyId']);

          logger.info({
            message: 'New guild set up',
            guild,
          });

          resolve(true);
        },
        DEFAULT_COMPONENT_EXPIRATION,
        () => {
          ctx.timeout();
          reject(new Error('Timed out'));
        },
      );
    });
  }
}
