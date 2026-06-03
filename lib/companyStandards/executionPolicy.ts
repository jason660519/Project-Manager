import { evaluateTerminalCommandDetailed } from '../ai-assistants/terminalBoundaries';
import type {
  PermissionState,
  TerminalOperationalBoundaries,
} from '../ai-assistants/types';
import { loadSystemCliExposureMap } from '../storage/system-cli';
import { formatGateNpmCommand, getStandardsGate, type StandardsGateId } from './standardsGates';

export type ExecutionPolicyLayer =
  | 'runtime'
  | 'assistant_permission'
  | 'system_cli_exposure'
  | 'terminal_boundaries'
  | 'bridge_terminal';

export interface ExecutionPolicyFailure {
  layer: ExecutionPolicyLayer;
  /** i18n key suffix under companyStandards.gates.policy* */
  messageKey:
    | 'runtimeDesktopRequired'
    | 'permissionBlocked'
    | 'cliNotExposed'
    | 'terminalBlocked'
    | 'bridgeBlocked';
  detail?: string;
  matchedRuleId?: string;
}

export interface StandardsGatePolicyContext {
  gateId: StandardsGateId;
  isTauri: boolean;
  runCommandPermission: PermissionState;
  terminalBoundaries: TerminalOperationalBoundaries;
  npmInGlobalInventory: boolean;
  npmExposed: boolean;
}

export function buildStandardsGatePolicyContext(input: {
  gateId: StandardsGateId;
  isTauri: boolean;
  runCommandPermission: PermissionState;
  terminalBoundaries: TerminalOperationalBoundaries;
  npmInGlobalInventory: boolean;
}): StandardsGatePolicyContext {
  const exposure = loadSystemCliExposureMap();
  return {
    gateId: input.gateId,
    isTauri: input.isTauri,
    runCommandPermission: input.runCommandPermission,
    terminalBoundaries: input.terminalBoundaries,
    npmInGlobalInventory: input.npmInGlobalInventory,
    npmExposed: exposure.npm === true,
  };
}

/**
 * Evaluate layers 1–4 (sync). Caller runs bridge terminal eval separately when spawning.
 */
export function evaluateStandardsGateExecutionPolicy(
  ctx: StandardsGatePolicyContext,
): ExecutionPolicyFailure | null {
  if (!ctx.isTauri) {
    return { layer: 'runtime', messageKey: 'runtimeDesktopRequired' };
  }

  if (ctx.runCommandPermission === 'blocked') {
    return { layer: 'assistant_permission', messageKey: 'permissionBlocked' };
  }

  if (ctx.npmInGlobalInventory && !ctx.npmExposed) {
    return { layer: 'system_cli_exposure', messageKey: 'cliNotExposed' };
  }

  const gate = getStandardsGate(ctx.gateId);
  const commandLine = formatGateNpmCommand(gate);
  const terminal = evaluateTerminalCommandDetailed(commandLine, ctx.terminalBoundaries);
  if (terminal.decision !== 'allowed') {
    return {
      layer: 'terminal_boundaries',
      messageKey: 'terminalBlocked',
      detail: terminal.blockedSegment ?? commandLine,
      matchedRuleId: terminal.matchedRuleId,
    };
  }

  return null;
}

export function mapBridgeTerminalFailure(
  reason?: string,
  matchedRuleId?: string,
): ExecutionPolicyFailure {
  return {
    layer: 'bridge_terminal',
    messageKey: 'bridgeBlocked',
    detail: reason,
    matchedRuleId,
  };
}
