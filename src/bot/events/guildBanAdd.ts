import { Guild, GuildMember } from 'discord.js';
import guildMemberRemove from './guildMemberRemove';

export default function guildBanAdd(_: Guild, member: GuildMember) {
  return guildMemberRemove(member);
}
