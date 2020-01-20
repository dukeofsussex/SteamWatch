import { Role, User } from 'discord.js';
import { Command, CommandoClient, CommandMessage } from 'discord.js-commando';
import db from '../../db';
import env from '../../env';

async function addMentionsAsync(message: CommandMessage, watcherId: number, mentions: (Role | User)[]) {
  const mentionCount = await db.count('* AS count')
    .from('app_watcher_mention')
    .where('watcher_id', watcherId)
    .first()
    .then((result: any) => result.count);

  if (mentionCount === env.bot.maxMentionsPerWatcher) {
    return message.say('Maximum amount of mentions reached!');
  }

  let mentionSlice = mentions;

  if (mentionCount + mentions.length > env.bot.maxMentionsPerWatcher) {
    mentionSlice = mentions.slice(0, env.bot.maxMentionsPerWatcher - mentionCount);
  }

  await db.insert(mentionSlice.map((mention) => ({
    watcherId,
    entityId: mention.id,
    type: mention instanceof Role ? 'role' : 'user',
  }))).into('app_watcher_mention');

  return message.say(`Added mentions for ${mentionSlice.map((mention) => (mention instanceof Role ? mention.name : mention.username)).join(',')}`);
}

async function delMentionsAsync(message: CommandMessage, watcherId: number, mentions: (Role | User)[]) {
  const removed = await db.delete()
    .from('app_watcher_mention')
    .whereIn('entity_id', mentions.map((mention) => mention.id))
    .andWhere('watcher_id', watcherId);

  return message.say(`Removed ${removed} mentions`);
}

async function listMentionsAsync(message: CommandMessage, watcherId: number, guildId: string) {
  const mentions = await db.select('entity_id', 'type', 'name')
    .from('app_watcher_mention')
    .innerJoin('app_watcher', 'app_watcher_mention.watcher_id', 'app_watcher.id')
    .innerJoin('app', 'app_watcher.app_id', 'app.id')
    .where({
      watcherId,
      guildId,
    });

  const entities = [];

  for (let i = 0; i < mentions.length; i += 1) {
    const mention = mentions[i];

    if (mention.type === 'role') {
      entities.push(message.guild.roles.get(mention.entityId)?.name || 'N/A');
    } else {
      entities.push(message.guild.members.get(mention.entityId)?.user.username || 'N/A');
    }
  }

  return message.say(`Mentioning ${entities.join(',')} for **${mentions[0].name}**`);
}

export default class ListCommand extends Command {
  constructor(client: CommandoClient) {
    super(client, {
      name: 'mention',
      group: 'apps',
      memberName: 'mention',
      description: 'Manage mentions for watchers.',
      guildOnly: true,
      // @ts-ignore Missing typings
      userPermissions: ['MANAGE_CHANNELS'],
      argsPromptLimit: 0,
      args: [
        {
          key: 'watcherId',
          prompt: 'Missing watcher id',
          type: 'integer',
        },
        {
          key: 'option',
          prompt: 'Option',
          type: 'string',
          // @ts-ignore Missing typings
          oneOf: ['add', 'del', 'list'],
          default: 'list',
        },
        {
          key: 'mentions',
          prompt: 'Mentions',
          type: 'mention-list',
          default: [],
        },
      ],
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async run(message: CommandMessage, { watcherId, option, mentions }: { watcherId: number, option: 'add' | 'del' | 'list', mentions: (Role | User)[] }) {
    const watcherExists = await db.select('1 AS `exists`')
      .from('app_watcher')
      .where({
        id: watcherId,
        guildId: message.guild.id,
      })
      .first()
      .then((result: any) => result?.exists || 0);

    if (!watcherExists) {
      return message.say(`Unable to find a watcher with the identifier **${watcherId}**!`);
    }

    switch (option) {
      case 'add':
        return addMentionsAsync(message, watcherId, mentions);
      case 'del':
        return delMentionsAsync(message, watcherId, mentions);
      default:
        return listMentionsAsync(message, watcherId, message.guild.id);
    }
  }
}
