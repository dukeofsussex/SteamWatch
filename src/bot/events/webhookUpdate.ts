import { TextChannel, Webhook } from 'discord.js';
import db from '../../db';

// Used to prevent webhooks from being duplicated
const webhookBeingSet: {
  [key: string]: boolean;
} = {};

export default async function webhookUpdate(channel: TextChannel) {
  if (webhookBeingSet[channel.id]) {
    return;
  }

  const results = await Promise.all([
    channel.fetchWebhooks(),
    db.select({ id: 'webhook_id' })
      .from('channel_webhook')
      .innerJoin('app_watcher', 'app_watcher.channel_id', 'webhook.id')
      .where('id', channel.id)
      .first(),
  ]);

  if (!results[1] || results[0].map((hook: Webhook) => hook.id).includes(results[1].id)) {
    return;
  }

  webhookBeingSet[channel.id] = true;

  const webhook = await channel.createWebhook(
    channel.client.user.username,
    channel.client.user.avatarURL,
    'Required by SteamWatch',
  );

  await db('channel_webhook').update({ webhookId: webhook.id, webhookToken: webhook.token })
    .where('id', channel.id);

  delete webhookBeingSet[channel.id];
}
