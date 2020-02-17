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
    db.select('token')
      .from('webhook')
      .where('id', channel.id)
      .first(),
  ]);

  if (!results[1] || results[0].map((hook: Webhook) => hook.token).includes(results[1].token)) {
    return;
  }

  webhookBeingSet[channel.id] = true;

  const webhook = await channel.createWebhook(
    channel.client.user.username,
    channel.client.user.avatarURL,
    'Required by SteamWatch',
  );

  await db('webhook').update({ token: webhook?.token })
    .where('id', channel.id);

  delete webhookBeingSet[channel.id];
}
