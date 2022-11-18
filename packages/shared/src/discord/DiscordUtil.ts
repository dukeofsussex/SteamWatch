import { EMOJIS } from '../constants';

export default class DiscordUtil {
  static getFlagEmoji(cc: string) {
    const emoji = cc === 'at' ? 'eu' : cc; // Special case
    return String.fromCodePoint(...[...emoji.toUpperCase()].map((x) => 0x1f1a5 + x.charCodeAt(0)));
  }

  static getStateEmoji(status: any) {
    return status ? EMOJIS.SUCCESS : EMOJIS.ERROR;
  }
}
