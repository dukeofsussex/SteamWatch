// @ts-ignore Missing typings
import { Constants } from 'discord.js';

const EMBED_COLOURS = {
  DEFAULT: 0x00ADEE,
  ERROR: Constants.Colors.RED,
  PENDING: Constants.Colors.ORANGE,
  SUCCESS: Constants.Colors.GREEN,
};

const EMOJIS: {
  [key:string]: string;
} = {
  ALERT: '\uD83D\uDEA8',
  DM: '\uD83D\uDCEC',
  ERROR: '\u274C',
  EYES: '\uD83D\uDC40',
  NEWS: '\uD83D\uDCF0',
  PING_PONG: '\uD83C\uDFD3',
  PRICE_DOWN: '\uD83D\uDCC9',
  PRICE_UP: '\uD83D\uDCC8',
  SUCCESS: '\u2705',
};

export {
  EMBED_COLOURS,
  EMOJIS,
};
