import { describe, expect, it } from 'vitest';
import { createDefaultTerminalBoundaries } from '../lib/ai-assistants/terminalBoundaries';
import {
  evaluateStandardsGateExecutionPolicy,
  type StandardsGatePolicyContext,
} from '../lib/companyStandards/executionPolicy';

function ctx(overrides: Partial<StandardsGatePolicyContext>): StandardsGatePolicyContext {
  return {
    gateId: 'i18n',
    isTauri: true,
    runCommandPermission: 'granted',
    terminalBoundaries: createDefaultTerminalBoundaries(),
    npmInGlobalInventory: true,
    npmExposed: true,
    ...overrides,
  };
}

describe('evaluateStandardsGateExecutionPolicy', () => {
  it('requires Tauri runtime', () => {
    const failure = evaluateStandardsGateExecutionPolicy(ctx({ isTauri: false }));
    expect(failure?.layer).toBe('runtime');
  });

  it('blocks when tool:run_command is blocked', () => {
    const failure = evaluateStandardsGateExecutionPolicy(
      ctx({ runCommandPermission: 'blocked' }),
    );
    expect(failure?.layer).toBe('assistant_permission');
    expect(failure?.messageKey).toBe('permissionBlocked');
  });

  it('allows guarded permission for operator gate runs', () => {
    expect(
      evaluateStandardsGateExecutionPolicy(ctx({ runCommandPermission: 'guarded' })),
    ).toBeNull();
  });

  it('blocks when npm is inventoried but not exposed', () => {
    const failure = evaluateStandardsGateExecutionPolicy(
      ctx({ npmInGlobalInventory: true, npmExposed: false }),
    );
    expect(failure?.layer).toBe('system_cli_exposure');
  });

  it('skips exposure check when npm is not in global inventory', () => {
    expect(
      evaluateStandardsGateExecutionPolicy(
        ctx({ npmInGlobalInventory: false, npmExposed: false }),
      ),
    ).toBeNull();
  });

  it('blocks destructive commands via terminal blacklist', () => {
    const failure = evaluateStandardsGateExecutionPolicy(
      ctx({
        gateId: 'i18n',
        terminalBoundaries: {
          ...createDefaultTerminalBoundaries(),
          policyMode: 'default-deny',
          whitelist: [],
          blacklist: [
            {
              id: 'bl-test',
              pattern: 'npm run i18n:check',
              description: 'test',
              category: 'destructive',
              listKind: 'blacklist',
            },
          ],
        },
      }),
    );
    expect(failure?.layer).toBe('terminal_boundaries');
  });
});
