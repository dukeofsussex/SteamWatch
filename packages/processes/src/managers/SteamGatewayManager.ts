import {
  db,
  logger,
  Manager,
  steamClient,
} from '@steamwatch/shared';

export default class SteamGatewayManager implements Manager {
  async start() {
    steamClient.addListener('changelist', this.onChangeListReceived);
  }

  stop() {
    steamClient.removeListener('changelist', this.onChangeListReceived);
  }

  // eslint-disable-next-line class-methods-use-this
  private async onChangeListReceived(_: number, appIds: number[]) {
    const storedApps = await db.select('id')
      .from('app')
      .whereIn('id', appIds);

    if (!storedApps.length) {
      return;
    }

    logger.info(`Updating ${storedApps.length} apps...`);

    const { apps } = await steamClient.getProductInfo(storedApps.map((app) => app.id), [], true);

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
  }
}
