import SteamUser from 'steam-user';
import db from '../db';
import env from '../env';
import logger from '../logger';

const steamUser = new SteamUser({ enablePicsCache: true });

if (env.debug) {
  // @ts-ignore Missing typings
  steamUser.on('debug', (message: string) => {
    logger.debug({
      label: 'Steam:debug',
      message,
    });
  });
}

steamUser.on('disconnected', (_, msg) => {
  logger.info({
    label: 'Steam:disconnected',
    message: `Disconnected: (${msg || 'Unknown'})`,
  });
});
steamUser.on('error', (err) => logger.error({
  label: 'Steam:error',
  message: err.message,
  err,
}));
steamUser.on('loggedOn', (details) => {
  if (details['eresult'] !== SteamUser.EResult.OK) {
    logger.error({
      label: 'Steam:loggedOn',
      message: 'Failed to log in to Steam!',
      details,
    });
  } else {
    logger.info({
      label: 'Steam:loggedOn',
      message: 'Logged in',
    });
  }
});

// TODO Move to worker
steamUser.on('changelist', async (_: number, appIds: number[]) => {
  const storedApps = await db.select('id')
    .from('app')
    .whereIn('id', appIds);

  if (!storedApps.length) {
    return;
  }

  // logger.debug({
  //   label: 'Steam',
  //   message: 'Updating apps...',
  // });

  const { apps } = await steamUser.getProductInfo(storedApps.map((app) => app.id), [], true);

  for (let i = 0; i < storedApps.length; i += 1) {
    const appInfo = apps[storedApps[i]!.id]!.appinfo;

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
