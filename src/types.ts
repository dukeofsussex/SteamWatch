export interface Manager {
  start(): Promise<void> | void;
  stop(): Promise<void> | void;
}
