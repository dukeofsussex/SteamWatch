import { CommandoGuild } from 'discord.js-commando';
import db from '../../db';
import logger from '../../logger';

const REGION_CURRENCY_MAPPING: {
  [key: string]: string;
} = {
  brazil: 'BRL',
  europe: 'EUR',
  hongkong: 'HKD',
  india: 'INR',
  japan: 'JPY',
  russia: 'RUB',
  singapore: 'SGD',
  southafrica: 'ZAR',
  sydney: 'AUD',
  'us-central': 'USD',
  'us-east': 'USD',
  'us-south': 'USD',
  'us-west': 'USD',
};

export default async function guildCreate(guild: CommandoGuild) {
  const exists = await db.select('id')
    .from('guild')
    .where('id', guild.id)
    .first()
    .then((res: any) => !!res);

  if (exists) {
    return;
  }

  const currencyId = await db.select('id')
    .from('currency')
    .where('abbreviation', REGION_CURRENCY_MAPPING[guild.region] || 'USD')
    .first()
    .then((res: any) => res.id);

  await db.insert({
    id: guild.id,
    name: guild.name,
    region: guild.region,
    memberCount: guild.memberCount,
    currencyId,
  }).into('guild');

  if (guild.id === '264445053596991498') {
    // eslint-disable-next-line no-param-reassign
    guild.commandPrefix = '';
  }

  logger.info({
    group: 'Bot',
    message: `Joined guild ${guild.name} (${guild.memberCount} members)`,
  });
}
