import { Guild, GuildMember } from 'discord.js';
import guildMemberRemove from './guildMemberRemove';

export default function guildBanAdd(guild: Guild, member: GuildMember) {
  return guildMemberRemove(member);
}
