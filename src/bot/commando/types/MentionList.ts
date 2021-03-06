import { GuildMember, Role } from 'discord.js';
import { Argument, ArgumentType, CommandoMessage } from 'discord.js-commando';
import SteamWatchClient from '../../structures/SteamWatchClient';

export default class MentionListType extends ArgumentType {
  types: ArgumentType[];

  constructor(client: SteamWatchClient) {
    super(client, 'mention-list');

    this.types = [
      client.registry.types.get('role')!,
      client.registry.types.get('member')!,
    ];
  }

  async validate(val: string, msg: CommandoMessage, arg: Argument) {
    const mentions = val.split(',');

    let results: (string | boolean | Promise<string | boolean>)[] = [];
    for (let i = 0; i < mentions.length; i += 1) {
      const mention = mentions[i];

      results = results.concat(
        this.types.map((type) => type.validate(mention, msg, arg)),
      );
    }

    results = await Promise.all(results);

    if (results.some((valid) => valid && typeof valid !== 'string')) {
      return true;
    }

    const errors = results.filter((valid) => typeof valid === 'string');
    if (errors.length > 0) {
      return errors.join('\n');
    }

    return false;
  }

  parse(val: string, msg: CommandoMessage, arg: Argument) {
    const mentions = val.split(',');

    let results: (null | Role | GuildMember | Promise<Role | GuildMember>)[] = [];
    for (let i = 0; i < mentions.length; i += 1) {
      results = results.concat(this.types.map((type) => type.parse(mentions[i].trim(), msg, arg)));
    }

    results = results.filter((result) => result !== null);

    if (results.length === 0) {
      throw new Error(`Couldn't parse mentions for "${val}"!`);
    }

    return results;
  }

  // eslint-disable-next-line class-methods-use-this
  isEmpty(val: string) {
    return !val || val.length === 0;
  }
}
