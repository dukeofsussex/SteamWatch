import SteamUser from 'steam-user';
import db from '../db';
import env from '../utils/env';
import logger from '../utils/logger';

const steamUser = new SteamUser({ enablePicsCache: true });

if (env.debug) {
  // @ts-ignore Missing typings
  steamUser.on('debug', (message: string) => {
    logger.debug({
      group: 'Steam',
      message,
    });
  });
}

steamUser.on('disconnected', (_, msg) => {
  logger.info({
    group: 'Steam',
    message: `Disconnected: (${msg || 'Unknown'})`,
  });
});
steamUser.on('error', (err) => logger.error({
  group: 'Steam',
  message: err.message,
  err,
}));
steamUser.on('loggedOn', (details) => {
  if (details.eresult !== SteamUser.EResult.OK) {
    logger.error({
      group: 'Steam',
      message: 'Failed to log in!',
      details,
    });
  } else {
    logger.info({
      group: 'Steam',
      message: 'Logged in',
    });
  }
});
steamUser.on('changelist', async (_: number, appIds: number[]) => {
  const storedApps = await db.select('id')
    .from('app')
    .whereIn('id', appIds);

  if (!storedApps.length) {
    return;
  }

  logger.debug({
    group: 'Steam',
    message: 'Updating apps...',
  });

  const { apps } = await steamUser.getProductInfo(storedApps.map((app) => app.id), [], true);

  for (let i = 0; i < storedApps.length; i += 1) {
    const appInfo = apps[storedApps[i].id].appinfo;

    if (!appInfo) {
      // eslint-disable-next-line no-await-in-loop
      await db('app').update({
        id: appInfo.id,
        name: appInfo.common.name,
        icon: appInfo.common.icon,
      });
    }
  }
});

steamUser.logOn();

export default steamUser;
