import MessageQueue from './MessageQueue';
import NewsWatcher from './watchers/NewsWatcher';
import PriceWatcher from './watchers/PriceWatcher';
import Watcher from './watchers/Watcher';
import { Manager } from '../types';

export default class WatcherManager implements Manager {
  private messageQueue: MessageQueue;

  private watchers: Watcher[];

  constructor() {
    this.messageQueue = new MessageQueue();

    this.watchers = [
      new NewsWatcher(this.messageQueue),
      new PriceWatcher(this.messageQueue),
    ];
  }

  async start() {
    await this.messageQueue.start();
    this.watchers.map((watcher) => watcher.start());
  }

  async stop() {
    this.watchers.map((watcher) => watcher.stop());
    await this.messageQueue.stop();
  }
}
