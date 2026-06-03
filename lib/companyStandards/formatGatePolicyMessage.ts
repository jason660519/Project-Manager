import type { Translations } from '../i18n/types';
import type { ExecutionPolicyFailure } from './executionPolicy';

type GatePolicyMessages = Translations['companyStandards']['gates'];

export function formatGatePolicyMessage(
  failure: ExecutionPolicyFailure,
  g: GatePolicyMessages,
): string {
  const base = policyMessageForKey(failure.messageKey, g);
  if (failure.layer === 'terminal_boundaries' && failure.detail) {
    return `${base} (${failure.detail})`;
  }
  if (failure.layer === 'bridge_terminal' && failure.detail) {
    return `${base} ${failure.detail}`;
  }
  return base;
}

function policyMessageForKey(
  key: ExecutionPolicyFailure['messageKey'],
  g: GatePolicyMessages,
): string {
  switch (key) {
    case 'runtimeDesktopRequired':
      return g.desktopRequired;
    case 'permissionBlocked':
      return g.policyPermissionBlocked;
    case 'cliNotExposed':
      return g.policyCliNotExposed;
    case 'terminalBlocked':
      return g.policyTerminalBlocked;
    case 'bridgeBlocked':
      return g.policyBridgeBlocked;
    default:
      return g.spawnFailed;
  }
}

export function formatStandardsGateRunError(
  error: unknown,
  g: GatePolicyMessages,
): string {
  if (error && typeof error === 'object' && 'policyFailure' in error) {
    const failure = (error as { policyFailure?: ExecutionPolicyFailure }).policyFailure;
    if (failure) return formatGatePolicyMessage(failure, g);
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
