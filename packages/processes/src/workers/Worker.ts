import type { Manager } from '@steamwatch/shared';

export default abstract class Worker implements Manager {
  protected readonly breakMs: number;

  protected timeout?: NodeJS.Timeout | undefined;

  constructor(breakMs: number) {
    this.breakMs = breakMs;
  }

  start() {
    this.work();
  }

  stop() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
  }

  protected wait() {
    this.timeout = setTimeout(() => this.work(), this.breakMs);
  }

  protected abstract work(): Promise<void>;
}
