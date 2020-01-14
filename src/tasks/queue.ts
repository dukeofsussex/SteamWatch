export interface QueueProcessorCallback {
  (item: any): void;
}

export default class Queue {
  private items: object[];

  private interval: number;

  private intervalId?: NodeJS.Timeout;

  private running: boolean;

  private processor?: Function;

  constructor(interval: number) {
    this.interval = interval;
    this.items = [];
    this.running = false;
  }

  add(item: any) {
    this.items.push(item);
  }

  addList(items: any[]) {
    this.items = this.items.concat(items);
  }

  clear() {
    this.items = [];
  }

  get isRunning() {
    return this.intervalId !== undefined;
  }

  get length() {
    return this.items.length;
  }

  start() {
    if (!this.processor) {
      throw new Error('Please set up a queue processor');
    }

    this.running = true;

    this.intervalId = setInterval(() => this.onInterval(), this.interval);
  }

  stop() {
    if (!this.intervalId) {
      return;
    }

    clearTimeout(this.intervalId);
    this.intervalId = undefined;
  }

  onProcess(processor: QueueProcessorCallback) {
    this.processor = processor;
  }

  private onInterval() {
    if (this.items.length === 0) {
      this.stop();
      return;
    }

    this.processor!(this.items.shift());
  }
}
