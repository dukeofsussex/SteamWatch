import { Command, CommandoClient, CommandMessage } from 'discord.js-commando';
import { GuildChannel, TextChannel } from 'discord.js';
import db from '../../db';
import env from '../../env';
import steam from '../../steam/steam';

export default class AddCommand extends Command {
  constructor(client: CommandoClient) {
    super(client, {
      name: 'add',
      group: 'apps',
      memberName: 'add',
      description: 'Adds an app that should be watched.',
      guildOnly: true,
      // @ts-ignore
      userPermissions: ['MANAGE_CHANNELS'],
      argsPromptLimit: 0,
      args: [
        {
          key: 'appid',
          prompt: 'App id',
          type: 'integer',
        },
        {
          key: 'channel',
          prompt: 'Channel',
          type: 'channel', // TODO text-channel
          default: -1,
        },
      ],
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async run(message: CommandMessage, { appid, channel }: { appid: number, channel: GuildChannel }) {
    const watchedCount = await db.count('* AS count')
      .from('app_watcher')
      .where('guild_id', message.guild.id)
      .first()
      .then((result: any) => result.count);

    if (watchedCount >= env.bot.maxAppsPerGuild) {
      return message.say(`This guild already has the maximum amount of watched apps [${watchedCount}/${env.bot.maxAppsPerGuild}].`);
    }

    if (channel instanceof GuildChannel && !(channel instanceof TextChannel)) {
      return message.say(`<#${channel.id}> isn't a text channel.`);
    }

    const watcherChannelId = channel.id || message.channel.id;

    const isDuplicate = await db.select('1 AS `exists`')
      .from('app_watcher')
      .where({
        guildId: message.guild.id,
        appId: appid,
        channelId: watcherChannelId,
      })
      .first()
      .then((result: any) => result?.exists || 0);

    if (isDuplicate) {
      return message.say(`You already have a watcher for **${appid}** configured for <#${watcherChannelId}>.`);
    }

    let app: any = await db.select('id', 'name')
      .from('app')
      .where('id', appid)
      .first();

    if (!app) {
      app = await steam.getAppInfoAsync(appid);

      if (!app) {
        return message.say(`Unable to find an app with the id **${appid}**`);
      }

      await db.insert({
        id: app.appid,
        name: app.details.name,
        type: app.details.type,
        lastChecked: null,
      }).into('app');

      const count = await db.count('* AS count')
        .from('app')
        .first()
        .then((res: any) => res.count);

      this.client.user.setActivity(`${count} apps`, { type: 'WATCHING' });
    }

    await db.insert({
      appId: appid,
      channelId: watcherChannelId,
      guildId: message.guild.id,
    }).into('app_watcher');

    return message.say(`Watcher added for **${app.name}**`);
  }
}
