import { registerAllCapabilities, listCapabilitiesByApp, OpenClawBridge } from './shared-bridge';

export { registerAllCapabilities, listCapabilitiesByApp, OpenClawBridge };

// Auto-register v0 plugin contracts
registerAllCapabilities();

export function getOpenClawBridge(): OpenClawBridge {
  return new OpenClawBridge('http://127.0.0.1:18790');
}
