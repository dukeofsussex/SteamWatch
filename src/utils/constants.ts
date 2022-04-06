import { oneLineTrim } from 'common-tags';
import { Permissions } from 'slash-create';
import env from './env';
import { WatcherType } from '../types';
import { homepage } from '../../package.json';

export const DISCORD_ERROR_CODES = {
  UNKNOWN_CHANNEL: 10003,
  UNKNOWN_WEBHOOK_CODE: 10015,
  MISSING_ACCESS: 50001,
};

export const EMBED_COLOURS = {
  DEFAULT: 0x00ADEE,
  ERROR: 0xed4245,
  PENDING: 0xe67e22,
  SUCCESS: 0x57f287,
};

export const EMOJIS = {
  ALERT: '\uD83D\uDEA8',
  DM: '\uD83D\uDCEC',
  ERROR: '\u274C',
  PING_PONG: '\uD83C\uDFD3',
  PRICE_DOWN: '\uD83D\uDCC9',
  PRICE_UP: '\uD83D\uDCC8',
  SUCCESS: '\u2705',
  TADA: '\uD83C\uDF89',
};

const perms = new Permissions([
  Permissions.FLAGS.MANAGE_WEBHOOKS,
]).bitfield;

export const INVITE_URL = oneLineTrim`
  https://discord.com/oauth2/authorize
  ?client_id=${env.discord.appId}
  &permissions=${perms}
  &scope=applications.commands%20bot
`;

export const MAX_OPTIONS = 25;

export const PERMITTED_APP_TYPES: { [key: string]: string[]; } = {
  [WatcherType.NEWS]: ['application', 'game'],
  [WatcherType.PRICE]: ['application', 'dlc', 'game', 'music', 'video'],
  [WatcherType.WORKSHOP]: ['game'],
};

export const REPO_URL = homepage.split('#')[0];

export const WEBSITE_URL = 'https://steam.watch';
