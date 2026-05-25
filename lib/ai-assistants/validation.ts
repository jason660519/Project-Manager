import type { AssistantInstanceConfig } from './types';

export interface InstanceValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function isLocalDevUrl(url: URL): boolean {
  return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
}

export function validateAssistantInstance(instance: AssistantInstanceConfig): InstanceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const gateway = new URL(instance.gatewayAccess);
    if (gateway.protocol !== 'https:' && !(gateway.protocol === 'http:' && isLocalDevUrl(gateway))) {
      errors.push('Gateway Access must use https://, except localhost http:// in development.');
    }
  } catch {
    errors.push('Gateway Access must be a valid URL.');
  }

  try {
    const websocket = new URL(instance.websocketUrl);
    if (websocket.protocol !== 'wss:' && !(websocket.protocol === 'ws:' && isLocalDevUrl(websocket))) {
      errors.push('WebSocket URL must use wss://, except localhost ws:// in development.');
    }
  } catch {
    errors.push('WebSocket URL must be a valid ws:// or wss:// URL.');
  }

  if (!instance.gatewayTokenSecretRef.trim()) {
    errors.push('Gateway Token must be represented by a non-empty secret reference.');
  }

  if (instance.gatewayTokenStatus !== 'configured') {
    warnings.push('Gateway token is not configured; live gateway calls should remain disabled.');
  }

  if (instance.runtimeMode === 'browser-dry-run') {
    warnings.push('Browser dry-run mode can validate UI flow but should not be treated as production gateway access.');
  }

  return { valid: errors.length === 0, errors, warnings };
}
