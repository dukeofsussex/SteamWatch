const SIGNALS: NodeJS.Signals[] = ['SIGHUP', 'SIGINT', 'SIGTERM', 'SIGUSR2'];

export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function onShutdown(callback: () => void) {
  for (let i = 0; i < SIGNALS.length; i += 1) {
    const event = SIGNALS[i] as NodeJS.Signals;
    process.on(event, callback);
  }
}
