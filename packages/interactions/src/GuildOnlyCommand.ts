import { oneLine } from 'common-tags';
import { Routes, RESTGetAPIGuildThreadsResult } from 'discord-api-types/v10';
import { CommandContext, SlashCommand } from 'slash-create';
import {
  db,
  DiscordAPI,
  EPublishedFileInfoMatchingFileType as EPFIMFileType,
  MAX_OPTIONS,
  WatcherType,
} from '@steamwatch/shared';

export default class GuildOnlyCommand extends SlashCommand {
  override hasPermission(ctx: CommandContext) {
    return typeof ctx.guildID !== 'undefined' && super.hasPermission(ctx);
  }

  static async createCurrencyAutocomplete(query: string) {
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
        db.select('bundle.name', 'null AS filetype', 'watcher.*')
          .from('watcher')
          .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
          .innerJoin('bundle', 'bundle.id', 'watcher.bundle_id')
          .where('guild_id', guildId)
          .andWhere((builder) => (value
            ? builder.where('watcher.id', value)
              .orWhere('watcher.type', 'LIKE', `${value}%`)
              .orWhere('bundle.name', 'LIKE', `${value}%`)
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
        db.select('sub.name', 'null AS filetype', 'watcher.*')
          .from('watcher')
          .innerJoin('channel_webhook', 'channel_webhook.id', 'watcher.channel_id')
          .innerJoin('sub', 'sub.id', 'watcher.sub_id')
          .where('guild_id', guildId)
          .andWhere((builder) => (value
            ? builder.where('watcher.id', value)
              .orWhere('watcher.type', 'LIKE', `${value}%`)
              .orWhere('sub.name', 'LIKE', `${value}%`)
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
   * @returns Boolean indicating whether the guild has been set up.
   */
  protected static async isGuildSetUp(ctx: CommandContext) {
    return db.select('id')
      .from('guild')
      .whereNotNull('currencyId')
      .andWhere('id', ctx.guildID)
      .first()
      .then((res: any) => (res ? res.id !== 0 : false));
  }
}
