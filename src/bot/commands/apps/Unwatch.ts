import { CommandoMessage } from 'discord.js-commando';
import { Webhook } from 'discord.js';
import SteamWatchClient from '../../structures/SteamWatchClient';
import SteamWatchCommand from '../../structures/SteamWatchCommand';
import db from '../../../db';
import WebApi from '../../../steam/WebApi';
import { EMBED_COLOURS } from '../../../utils/constants';
import { insertEmoji } from '../../../utils/templateTags';

export default class UnwatchCommand extends SteamWatchCommand {
  constructor(client: SteamWatchClient) {
    super(client, {
      name: 'unwatch',
      group: 'apps',
      memberName: 'unwatch',
      description: 'Remove a watcher.',
      examples: [
        'unwatch 1',
      ],
      format: '<watcher id>',
      guildOnly: true,
      userPermissions: ['MANAGE_CHANNELS'],
      argsPromptLimit: 0,
      args: [
        {
          key: 'watcherId',
          prompt: 'Watcher id',
          type: 'integer',
        },
      ],
      throttling: {
        duration: 10,
        usages: 2,
      },
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async run(
    message: CommandoMessage,
    { watcherId }: { watcherId: number },
  ) {
    const watcher = await db.select(
      'app_watcher.id',
      'app_watcher.app_id',
      'app.name',
      'icon',
      'channel_id',
      'webhook_id',
      'webhook_token',
    ).from('app_watcher')
      .innerJoin('app', 'app.id', 'app_watcher.app_id')
      .innerJoin('channel_webhook', 'channel_webhook.id', 'app_watcher.channel_id')
      .where({
        'app_watcher.id': watcherId,
        'app_watcher.guild_id': message.guild!.id,
      })
      .first();

    if (!watcher) {
      // @ts-ignore
      return message.embed({
        color: EMBED_COLOURS.ERROR,
        description: insertEmoji`:ERROR: Unable to find a watcher with the identifier **${watcherId}**!`,
      });
    }

    await db.delete()
      .from('app_watcher')
      .where('id', watcher.id);

    const count = await db.count('* AS count')
      .from('app_watcher')
      .where('channel_id', watcher.channelId)
      .first()
      .then((res: any) => parseInt(res.count, 10));

    if (count === 0) {
      await db.delete()
        .from('channel_webhook')
        .where('id', watcher.channelId);
      const webhook = new Webhook(this.client, {
        id: watcher.webhookId,
        token: watcher.webhookToken,
      });
      await webhook.delete();
    }

    // @ts-ignore
    return message.embed({
      color: EMBED_COLOURS.SUCCESS,
      description: insertEmoji`:SUCCESS: Removed watcher for **${watcher.name}** from <#${watcher.channelId}>!`,
      thumbnail: {
        url: WebApi.getIconUrl(watcher.appId, watcher.icon),
      },
    });
  }
}
