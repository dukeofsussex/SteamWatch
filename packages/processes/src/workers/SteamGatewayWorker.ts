import { join } from 'node:path';
import { subMonths } from 'date-fns';
import {
  db,
  logger,
  steamClient,
  SteamUtil,
} from '@steamwatch/shared';
import { EBillingType } from 'steam-user';
import Queue from '../Queue';

interface QueuedGateway {
  apps: number[];
  packages: number[];
}

const BATCH_SIZE = 100;
const IGNORED_PACKAGE_IDS = new Set([
  0, // Steam
  17906, // Anonymous Dedicated Server Comp
]);
const IGNORED_BILLING_TYPES = new Set([
  EBillingType.CommercialLicense,
  EBillingType.FreeCommercialLicense,
  EBillingType.FreeOnDemand,
  EBillingType.Gift,
  EBillingType.GuestPass,
  EBillingType.HardwarePromo,
  EBillingType.NumBillingTypes,
  EBillingType.OEMTicket,
  EBillingType.ProofOfPrepurchaseOnly,
  EBillingType.Rental,
]);

export default class SteamGatewayWorker extends Queue<QueuedGateway> {
  protected filePath: string;

  protected offset: {
    apps: number;
    packages: number;
  };

  protected queue: QueuedGateway;

  constructor() {
    super();
    this.filePath = join(__dirname, '..', '..', 'data', 'gateway.queue.json');
    this.offset = {
      apps: 0,
      packages: 0,
    };
    this.queue = {
      apps: [],
      packages: [],
    };
    this.queueDelay = 1000;
  }

  override async start() {
    steamClient.setOption('enablePicsCache', true);
    steamClient.setOption('changelistUpdateInterval', 15000);
    steamClient.addListener('changelist', this.onChangeListReceived.bind(this));
    super.start();
  }

  override async stop() {
    steamClient.removeListener('changelist', this.onChangeListReceived);
    super.stop();
  }

  protected async work() {
    if (!steamClient.connected) {
      logger.info('Waiting for Steam connection');
      this.wait();
      return;
    }

    const {
      apps,
      packages,
    } = this.dequeue();

    const res = await steamClient.getProductInfo(apps, packages, true);

    await Promise.all([
      SteamUtil.persistApps(Object.values(res.apps)),
      SteamUtil.persistFreePackages(Object.entries(res.packages), true),
    ]);

    const pricedApps = Object.values(res.packages)
      .filter((pkg) => pkg.packageinfo
        && !IGNORED_PACKAGE_IDS.has(pkg.packageinfo.packageid)
        && !IGNORED_BILLING_TYPES.has(pkg.packageinfo.billingtype))
      .reduce(
        (ids, pkg) => {
          pkg.packageinfo.appids.forEach((appId: number) => ids.add(appId));
          return ids;
        },
        new Set<number>(),
      );

    if (pricedApps.size) {
      await db('price').update('lastChecked', subMonths(new Date(), 1))
        .whereIn('appId', [...pricedApps]);
    }

    if (this.size()) {
      this.timeout = setTimeout(() => this.work(), this.queueDelay);
    } else if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }

    this.wait();
  }

  protected size() {
    return this.queue.apps.length - this.offset.apps
      + this.queue.packages.length - this.offset.packages;
  }

  private enqueue(ids: number[], queue: number[]) {
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i]!;

      if (!queue.includes(id)) {
        queue.push(id);
      }
    }

    super.run();
  }

  private dequeue() {
    const batch = {
      apps: [],
      packages: [],
    } as QueuedGateway;

    if (this.size() === 0) {
      return batch;
    }

    batch.apps = this.queue.apps.slice(
      this.offset.apps,
      this.offset.apps + Math.max(
        BATCH_SIZE / 2,
        BATCH_SIZE - (this.queue.packages.length - this.offset.packages),
      ),
    );
    batch.packages = this.queue.packages.slice(
      this.offset.packages,
      this.offset.packages + Math.max(
        BATCH_SIZE / 2,
        BATCH_SIZE - (this.queue.apps.length - this.offset.apps),
      ),
    );

    this.offset.apps += batch.apps.length;
    this.offset.packages += batch.packages.length;

    if (this.offset.apps * 2 >= this.queue.apps.length) {
      this.queue.apps = this.queue.apps.slice(this.offset.apps);
      this.offset.apps = 0;
    }

    if (this.offset.packages * 2 >= this.queue.packages.length) {
      this.queue.packages = this.queue.packages.slice(this.offset.packages);
      this.offset.packages = 0;
    }

    return batch;
  }

  private async onChangeListReceived(changeNumber: number, apps: number[], packages: number[]) {
    this.enqueue(apps, this.queue.apps);
    this.enqueue(packages, this.queue.packages);

    logger.info({
      message: 'Processing changelist',
      changeNumber,
      apps,
      packages,
    });
  }
}
