import MessageQueue from './MessageQueue';
import NewsWatcher from './watchers/News';
import PriceWatcher from './watchers/Prices';
import Watcher from './watchers/Watcher';

export default class WatcherManager {
  private messageQueue: MessageQueue;

  private watchers: Watcher[];

  constructor() {
    this.messageQueue = new MessageQueue();

    this.watchers = [
      new NewsWatcher(this.messageQueue),
      new PriceWatcher(this.messageQueue),
    ];
  }

  async startAsync() {
    await this.messageQueue.startAsync();
    this.watchers.map((watcher) => watcher.start());
  }

  async stopAsync() {
    this.watchers.map((watcher) => watcher.stop());
    await this.messageQueue.stopAsync();
  }
}
