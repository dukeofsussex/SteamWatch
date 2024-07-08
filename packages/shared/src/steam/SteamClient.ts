import { EResult } from 'steam-user';
import SteamWatchUser from './SteamWatchUser';
import env from '../env';
import logger from '../logger';

const steamClient = new SteamWatchUser();

if (env.debug) {
  // @ts-ignore Missing typings
  steamClient.on('debug', (message: string) => {
    logger.debug({
      label: 'Steam:debug',
      message,
    });
  });
}

steamClient.on('disconnected', (_, msg) => {
  logger.info({
    label: 'Steam:disconnected',
    message: msg || 'Unknown',
  });
  steamClient.connected = false;
});
steamClient.on('error', (err) => logger.error({
  label: 'Steam:error',
  message: err.message,
  err,
}));
steamClient.on('loggedOn', (details) => {
  if (details.eresult !== EResult.OK) {
    logger.error({
      label: 'Steam:loggedOn',
      message: 'Failed to log in to Steam',
      details,
    });
  } else {
    logger.info({
      label: 'Steam:loggedOn',
      message: 'Logged in',
    });
    steamClient.connected = true;
  }
});

export default steamClient;
