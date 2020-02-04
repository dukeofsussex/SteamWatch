// @ts-ignore Missing typings
import { Constants } from 'discord.js';
import env from '../env';

interface CURRENCIES {
  [key: string]: {
    cc: string;
    flag: string;
  }
}

const CURRENCIES: CURRENCIES = {
  AED: {
    cc: 'ae',
    flag: '🇦🇪',
  },
  ARS: {
    cc: 'ae',
    flag: '🇦🇷',
  },
  AUD: {
    cc: 'au',
    flag: '🇦🇺',
  },
  BRL: {
    cc: 'br',
    flag: '🇧🇷',
  },
  CAD: {
    cc: 'ca',
    flag: '🇨🇦',
  },
  CHF: {
    cc: 'ch',
    flag: '🇨🇭',
  },
  CLP: {
    cc: 'cl',
    flag: '🇨🇱',
  },
  CNY: {
    cc: 'cn',
    flag: '🇨🇳',
  },
  COP: {
    cc: 'co',
    flag: '🇨🇴',
  },
  CRC: {
    cc: 'cr',
    flag: '🇨🇷',
  },
  EUR: {
    cc: 'at',
    flag: '🇪🇺',
  },
  GBP: {
    cc: 'gb',
    flag: '🇬🇧',
  },
  HKD: {
    cc: 'hk',
    flag: '🇭🇰',
  },
  ILS: {
    cc: 'il',
    flag: '🇮🇱',
  },
  IDR: {
    cc: 'id',
    flag: '🇮🇩',
  },
  INR: {
    cc: 'in',
    flag: '🇮🇳',
  },
  JPY: {
    cc: 'jp',
    flag: '🇯🇵',
  },
  KRW: {
    cc: 'kr',
    flag: '🇰🇷',
  },
  KWD: {
    cc: 'kw',
    flag: '🇰🇼',
  },
  KZT: {
    cc: 'kz',
    flag: '🇰🇿',
  },
  MXN: {
    cc: 'mx',
    flag: '🇲🇽',
  },
  MYR: {
    cc: 'my',
    flag: '🇲🇾',
  },
  NOK: {
    cc: 'no',
    flag: '🇳🇴',
  },
  NZD: {
    cc: 'nz',
    flag: '🇳🇿',
  },
  PEN: {
    cc: 'pe',
    flag: '🇵🇪',
  },
  PHP: {
    cc: 'ph',
    flag: '🇵🇭',
  },
  PLN: {
    cc: 'pl',
    flag: '🇵🇱',
  },
  QAR: {
    cc: 'qa',
    flag: '🇶🇦',
  },
  RUB: {
    cc: 'ru',
    flag: '🇷🇺',
  },
  SAR: {
    cc: 'sa',
    flag: '🇸🇦',
  },
  SGD: {
    cc: 'sg',
    flag: '🇸🇬',
  },
  THB: {
    cc: 'th',
    flag: '🇹🇭',
  },
  TRY: {
    cc: 'tr',
    flag: '🇹🇷',
  },
  TWD: {
    cc: 'tw',
    flag: '🇹🇼',
  },
  UAH: {
    cc: 'ua',
    flag: '🇺🇦',
  },
  USD: {
    cc: 'us',
    flag: '🇺🇸',
  },
  UYU: {
    cc: 'uy',
    flag: '🇺🇾',
  },
  VND: {
    cc: 'vn',
    flag: '🇻🇳',
  },
  ZAR: {
    cc: 'za',
    flag: '🇿🇦',
  },
  'CIS-USD': {
    cc: 'am',
    flag: '🇦🇲',
  },
  'SASIA-USD': {
    cc: 'bd',
    flag: '🇧🇩',
  },
};

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
  ERROR: env.emoji.error,
  EYES: '\uD83D\uDC40',
  NEWS: '\uD83D\uDCF0',
  PING_PONG: '\uD83C\uDFD3',
  PRICE_DOWN: '\uD83D\uDCC9',
  PRICE_UP: '\uD83D\uDCC8',
  SUCCESS: env.emoji.success,
};

export {
  CURRENCIES,
  EMBED_COLOURS,
  EMOJIS,
};
