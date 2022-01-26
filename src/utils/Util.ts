import { EMOJIS } from './constants';

const SIGNALS: NodeJS.Signals[] = ['SIGHUP', 'SIGINT', 'SIGTERM', 'SIGUSR2'];

export default class Util {
  static capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  static getFlagEmoji(cc: string) {
    const emoji = cc === 'at' ? 'eu' : cc; // Special case
    return String.fromCodePoint(...[...emoji.toUpperCase()].map((x) => 0x1f1a5 + x.charCodeAt(0)));
  }

  static getStateEmoji(status: any) {
    return status ? EMOJIS.SUCCESS : EMOJIS.ERROR;
  }

  static onShutdown(callback: Function) {
    for (let i = 0; i < SIGNALS.length; i += 1) {
      const event = SIGNALS[i];
      process.on(event, () => callback());
    }
  }

  // https://github.com/discord/discord-api-docs/issues/4388
  static sanitizeOptionName(string: string) {
    return string.replace(/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/, '');
  }
}
