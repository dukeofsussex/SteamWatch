import { R_OK, W_OK } from 'node:constants';
import { access, readFile, writeFile } from 'node:fs/promises';
import { logger } from '@steamwatch/shared';
import Worker from './workers/Worker';

export default abstract class Queue<Q> extends Worker {
  private backupInterval?: NodeJS.Timeout;

  protected abstract filePath: string;

  protected abstract offset: any;

  protected abstract queue: Q;

  protected queueDelay: number;

  constructor() {
    super(10000); // 1m
    this.queueDelay = 250; // 0.25s
  }

  override async start() {
    try {
      // eslint-disable-next-line no-bitwise
      await access(this.filePath, R_OK | W_OK);
      const { offset, queue } = JSON.parse((await readFile(this.filePath)).toString());
      this.offset = offset;
      this.queue = queue;

      logger.info({
        message: 'Queue file found',
        length: this.size(),
        path: this.filePath,
      });
    } catch {
      logger.warn({
        message: 'No queue file found',
        path: this.filePath,
      });
    }

    this.run();

    this.backupInterval = setInterval(() => this.backupQueue(), 60000); // 1m
  }

  override async stop() {
    logger.info('Stopping queue');

    await this.backupQueue();

    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
  }

  protected run() {
    if (this.size() && !this.timeout) {
      this.timeout = setTimeout(() => this.work(), this.queueDelay);
    }
  }

  protected abstract size(): number;

  private backupQueue() {
    logger.info({
      message: 'Backing up queue',
      length: this.size(),
      path: this.filePath,
    });

    return writeFile(this.filePath, JSON.stringify({
      offset: this.offset,
      queue: this.queue,
    }));
  }
}
