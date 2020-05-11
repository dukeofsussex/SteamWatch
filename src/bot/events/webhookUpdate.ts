import { TextChannel, Webhook } from 'discord.js';
import db from '../../db';

// Prevent duplicate webhooks
const webhookQueue: {
  [key: string]: boolean;
} = {};

export default async function webhookUpdate(channel: TextChannel) {
  if (webhookQueue[channel.id]) {
    return;
  }

  const dbWebhook = await db.select({ id: 'webhook_id' })
    .from('channel_webhook')
    .innerJoin('app_watcher', 'app_watcher.channel_id', 'channel_webhook.id')
    .where('channel_webhook.id', channel.id)
    .first();

  if (!dbWebhook) {
    return;
  }

  const webhooks = await channel.fetchWebhooks();

  if (webhooks.map((hook: Webhook) => hook.id).includes(dbWebhook.id)) {
    return;
  }

  webhookQueue[channel.id] = true;

  const webhook = await channel.createWebhook(
    channel.client.user!.username,
    {
      avatar: channel.client.user!.displayAvatarURL(),
      reason: 'Required by SteamWatch',
    },
  );

  await db('channel_webhook').update({ webhookId: webhook.id, webhookToken: webhook.token })
    .where('id', channel.id);

  delete webhookQueue[channel.id];
}
