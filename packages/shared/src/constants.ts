import { oneLineTrim } from 'common-tags';
import { PermissionFlagsBits } from 'discord-api-types/v10';
import { Permissions } from 'slash-create';
import env from './env';
// @ts-ignore
// eslint-disable-next-line
import { homepage, version } from '../../../package.json'; // ESLint keeps changing the relative path

export const DEFAULT_CURRENCY = { code: 'USD', countryCode: 'US' };

export const DEFAULT_COMPONENT_EXPIRATION = 180000; // 3m

export const EMBED_COLOURS = {
  DEFAULT: 0x00ADEE,
  ERROR: 0xed4245,
  INACTIVE: 0x666666,
  PENDING: 0xe67e22,
  SUCCESS: 0x57f287,
};

export const EMOJIS = {
  ALERT: '\uD83D\uDEA8',
  CHECK: '\u2611',
  DM: '\uD83D\uDCEC',
  ERROR: '\u274C',
  LOCK: '\uD83D\uDD12',
  PIN: '\uD83D\uDCCC',
  PING_PONG: '\uD83C\uDFD3',
  PRICE_DOWN: '\uD83D\uDCC9',
  PRICE_UP: '\uD83D\uDCC8',
  SUCCESS: '\u2705',
  TADA: '\uD83C\uDF89',
  WARNING: '\u26A0',
};

const perms = new Permissions([
  PermissionFlagsBits.ManageWebhooks,
]).bitfield;

export const INVITE_URL = oneLineTrim`
  https://discord.com/oauth2/authorize
  ?client_id=${env.discord.appId}
  &permissions=${perms}
  &scope=applications.commands%20bot
`;

export const MAX_EMBEDS = 10;

export const MAX_OPTIONS = 25;

export const REPO_URL = homepage.split('#')[0]!;

export const PATREON_ICON = 'https://cdn.discordapp.com/icons/501792035657744425/394208f8a574a62f40a60e577fc96f2e.png';

export const STEAM_NEWS_APPID = 593110;

export const WEBSITE_URL = 'https://steam.watch';

export const VERSION = version;
