import NewsWatcher from './watchers/News';
import PriceWatcher from './watchers/Prices';
import SteamWatchClient from '../bot/structures/SteamWatchClient';

interface Watcher {
  start: Function;
  stop: Function;
}

export default class WatcherManager {
  private watchers: Watcher[];

  constructor(client: SteamWatchClient) {
    this.watchers = [
      new NewsWatcher(client),
      new PriceWatcher(client),
    ];
  }

  start() {
    this.watchers.map((watcher) => watcher.start());
  }

  stop() {
    this.watchers.map((watcher) => watcher.stop());
  }
}
