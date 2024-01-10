import { addHours, subMinutes, subMonths } from 'date-fns';
import {
  AppType,
  db,
  EmbedBuilder,
  FreePackage,
  FreePackageType,
  FreeWatcherFlag,
  logger,
  PackageInfo,
  partition,
  steamClient,
  SteamUtil,
  WatcherType,
} from '@steamwatch/shared';
import Watcher from './Watcher';
import type MessageQueue from '../MessageQueue';

const BATCH_SIZE = 50;
const HOURS_IN_ADVANCE = 6;

export default class FreeWatcher extends Watcher {
  constructor(queue: MessageQueue) {
    super(queue, 10000);
  }

  async work() {
    if (!steamClient.connected) {
      logger.info('Waiting for Steam connection');
      return this.wait();
    }

    let count = await FreeWatcher.processPackages();
    count += await this.processActivatablePackages();

    await db.delete()
      .from('free_package')
      .where('lastUpdate', '<', subMonths(new Date(), 3))
      .orWhere('endTime', '<', new Date());

    return count ? this.wait() : this.pause();
  }

  private async processActivatablePackages() {
    const activatable = await FreeWatcher.fetchNextActivatablePackages();

    for (let i = 0; i < activatable.length; i += 1) {
      const pkg = activatable[i];

      logger.info({
        message: 'Free package',
        pkg,
      });

      let flag = FreeWatcherFlag.None;

      if (pkg.type === FreePackageType.Weekend) {
        flag = FreeWatcherFlag.Weekend;
      } else if (pkg.appType === AppType.DLC) {
        flag = FreeWatcherFlag.KeepDLC;
      } else {
        flag = FreeWatcherFlag.KeepApp;
      }

      // eslint-disable-next-line no-await-in-loop
      await this.enqueue(
        [
          EmbedBuilder.createFreePackage({
            icon: pkg.appIcon,
            id: pkg.appId,
            name: pkg.appName,
          }, pkg),
        ],
        (builder) => builder.where('watcher.type', WatcherType.Free).andWhereRaw('free_flag & ? = ?', [flag, flag]),
      );
    }

    if (activatable.length) {
      await db('free_package').update('active', true)
        .whereIn('id', activatable.map((pkg) => pkg.id));
    }

    return activatable.length;
  }

  private static async processPackages() {
    const freePackages = await FreeWatcher.fetchNextPackages();

    if (!freePackages.length) {
      return 0;
    }

    logger.info({
      message: 'Checking free packages',
      freePackages,
    });

    const ids = freePackages.map((pkg) => pkg.id);
    let packages: [string, PackageInfo][] = [];

    try {
      packages = Object.entries((await steamClient.getProductInfo([], ids, true)).packages);
    } catch (err) {
      logger.error({
        message: 'Unable to fetch package details',
        freePackages,
        err,
      });
    }

    await db('free_package').update('lastChecked', new Date())
      .whereIn('id', ids);

    if (packages) {
      const [update, remove] = partition(
        packages,
        ([, pkg]) => !pkg.packageinfo || pkg.packageinfo.extended?.dontgrantifappidowned,
      );

      if (remove.length) {
        const removeIds = remove.map(([id]) => id);

        logger.info({
          message: 'Removing unrelated packages',
          ids: removeIds,
        });

        await db.delete()
          .from('free_package')
          .whereIn('id', removeIds);
      }

      await SteamUtil.persistFreePackages(update, false);
    }

    return packages.length;
  }

  private static async fetchNextActivatablePackages() {
    return db.select(
      { appId: 'app.id' },
      { appIcon: 'app.icon' },
      { appName: 'app.name' },
      { appType: 'app.type' },
      'free_package.*',
    ).from('free_package')
      .innerJoin('app', 'app.id', 'free_package.app_id')
      .where('startTime', '<=', addHours(new Date(), HOURS_IN_ADVANCE))
      .andWhere('endTime', '>', new Date())
      .andWhere('active', 0)
      .orderBy('startTime', 'asc')
      .limit(BATCH_SIZE);
  }

  private static async fetchNextPackages() {
    return db.select<FreePackage[]>('*')
      .from('free_package')
      .where('lastChecked', '<=', subMinutes(new Date(), 15))
      .andWhere('active', 0)
      .orderBy('lastChecked', 'asc')
      .limit(BATCH_SIZE);
  }
}
