import { Command } from 'discord.js-commando';
import SteamWatchClient from './SteamWatchClient';

export default class SteamWatchCommand extends Command {
  readonly client!: SteamWatchClient;
}
