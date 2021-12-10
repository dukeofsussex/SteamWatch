export interface Manager {
  start(): Promise<void> | void;
  stop(): Promise<void> | void;
}

export enum WatcherType {
  NEWS = 'news',
  PRICE = 'price',
  UGC = 'ugc',
}
