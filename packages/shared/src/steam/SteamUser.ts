import SteamUser from 'steam-user';
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
    message: msg || 'Unknown',
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

steamUser.logOn();

export default steamUser;
