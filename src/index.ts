import ProcessManager from './ProcessManager';
import onShutdown from './utils/onShutdown';

const processManager = new ProcessManager();
processManager.startAsync();
onShutdown(processManager.stopAsync);
