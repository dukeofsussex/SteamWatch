import NewsProcessor from './processors/News';
import PricesProcessor from './processors/Prices';
import SteamWatchClient from '../bot/structures/SteamWatchClient';

interface Processor {
  start: Function;
  stop: Function;
}

export default class Manager {
  private processors: Processor[];

  constructor(client: SteamWatchClient) {
    this.processors = [
      new NewsProcessor(client),
      new PricesProcessor(client),
    ];
  }

  start() {
    this.processors.map((processor) => processor.start());
  }

  stop() {
    this.processors.map((processor) => processor.stop());
  }
}
