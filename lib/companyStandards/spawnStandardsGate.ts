import {
  evaluateTerminalCommandBridge,
  listGlobalCliInventory,
  spawnAgent,
} from '../bridge';
import { loadAIAssistantsConsoleState } from '../ai-assistants/repository';
import { createDefaultTerminalBoundaries } from '../ai-assistants/terminalBoundaries';
import {
  buildStandardsGatePolicyContext,
  evaluateStandardsGateExecutionPolicy,
  mapBridgeTerminalFailure,
  type ExecutionPolicyFailure,
  type ExecutionPolicyLayer,
} from './executionPolicy';
import {
  formatGateNpmCommand,
  gateFeatureId,
  getGateInvocation,
  getStandardsGate,
  type StandardsGateId,
} from './standardsGates';

export class StandardsGateRunError extends Error {
  readonly layer?: ExecutionPolicyLayer;
  readonly policyFailure?: ExecutionPolicyFailure;

  constructor(
    message: string,
    readonly gateId: StandardsGateId,
    options?: {
      layer?: ExecutionPolicyLayer;
      policyFailure?: ExecutionPolicyFailure;
    },
  ) {
    super(message);
    this.name = 'StandardsGateRunError';
    this.layer = options?.layer;
    this.policyFailure = options?.policyFailure;
  }

  static fromPolicyFailure(
    gateId: StandardsGateId,
    failure: ExecutionPolicyFailure,
    humanMessage: string,
  ): StandardsGateRunError {
    return new StandardsGateRunError(humanMessage, gateId, {
      layer: failure.layer,
      policyFailure: failure,
    });
  }
}

export async function resolveStandardsGatePolicyContext(
  gateId: StandardsGateId,
  isTauri: boolean,
): Promise<ReturnType<typeof buildStandardsGatePolicyContext>> {
  const state = loadAIAssistantsConsoleState();
  const assistant =
    state.assistants.find((item) => item.id === state.selectedAssistantId) ??
    state.assistants[0];
  const runCommandPermission =
    assistant?.permissions.find((p) => p.scope === 'tool:run_command')?.state ?? 'blocked';
  const terminalBoundaries =
    assistant?.terminalBoundaries ?? createDefaultTerminalBoundaries();

  let npmInGlobalInventory = false;
  if (isTauri) {
    const inventory = await listGlobalCliInventory();
    npmInGlobalInventory = inventory.some((entry) => entry.command === 'npm');
  }

  return buildStandardsGatePolicyContext({
    gateId,
    isTauri,
    runCommandPermission,
    terminalBoundaries,
    npmInGlobalInventory,
  });
}

export async function assertStandardsGateExecutionAllowed(
  gateId: StandardsGateId,
  isTauri: boolean,
): Promise<ExecutionPolicyFailure | null> {
  const ctx = await resolveStandardsGatePolicyContext(gateId, isTauri);
  return evaluateStandardsGateExecutionPolicy(ctx);
}

export async function spawnStandardsGateRun(
  gateId: StandardsGateId,
  workingDir: string,
  isTauri: boolean,
  // Forwarded to spawnAgent's onBeforeNativeSpawn: fired after ALL preflight
  // (this helper's policy/inventory checks AND the bridge's own
  // assertCommandPolicyAllows), immediately before the native spawn. Lets the
  // caller open its exit-staging window around only the spawn invoke.
  onSpawnStart?: () => void,
): Promise<{
  spawnToken: number;
  pid: number;
  featureId: string;
  featureName: string;
  command: string;
  args: string[];
}> {
  const gate = getStandardsGate(gateId);
  if (!gate.npmScript) {
    throw new StandardsGateRunError(`Gate "${gateId}" is not runnable from the hub`, gateId);
  }

  const policyFailure = await assertStandardsGateExecutionAllowed(gateId, isTauri);
  if (policyFailure) {
    throw StandardsGateRunError.fromPolicyFailure(
      gateId,
      policyFailure,
      `Gate blocked at ${policyFailure.layer}`,
    );
  }

  const commandLine = formatGateNpmCommand(gate);
  const bridgeEval = await evaluateTerminalCommandBridge(commandLine);
  if (bridgeEval.decision !== 'allowed') {
    const failure = mapBridgeTerminalFailure(bridgeEval.reason, bridgeEval.matchedRuleId);
    throw StandardsGateRunError.fromPolicyFailure(
      gateId,
      failure,
      bridgeEval.reason ?? 'Command blocked by terminal policy',
    );
  }

  const inv = getGateInvocation(gateId);
  const { pid, spawnToken } = await spawnAgent({
    command: inv.command,
    args: inv.args,
    workingDir,
    onBeforeNativeSpawn: onSpawnStart,
  });

  return {
    spawnToken,
    pid,
    featureId: gateFeatureId(gateId),
    featureName: gate.label,
    command: inv.command,
    args: inv.args,
  };
}
