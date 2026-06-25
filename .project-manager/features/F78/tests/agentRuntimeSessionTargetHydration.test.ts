import { describe, expect, it, vi } from 'vitest';

import type {
  AgentRuntimeInventoryServiceResult,
  AgentRuntimePathObservation,
  AgentRuntimeToolRow,
} from '../../../../lib/agent-runtime';
import {
  hydrateAgentRuntimeRowsWithSessionTargets,
  mapAgentRuntimeInventoryRows,
} from '../../../../lib/integrations/mappers/agent-runtime';
import type { AgentRuntimeRedactedSessionTargetListResult } from '../../../../lib/bridge';

const loadedAt = '2026-06-23T00:00:00.000Z';

function pathObservation(
  overrides: Partial<AgentRuntimePathObservation> & Pick<AgentRuntimePathObservation, 'kind' | 'path'>,
): AgentRuntimePathObservation {
  return {
    exists: true,
    secretBearing: false,
    ...overrides,
  };
}

function toolRow(overrides: Partial<AgentRuntimeToolRow>): AgentRuntimeToolRow {
  return {
    rowId: 'agent-runtime:codex',
    toolId: 'codex',
    label: 'Codex CLI',
    command: 'codex',
    commandAvailable: true,
    status: 'ready',
    capabilities: {
      mcp: true,
      skills: true,
      sessions: true,
      cost: false,
    },
    paths: [],
    warnings: [],
    ...overrides,
  };
}

function serviceResult(rows: AgentRuntimeToolRow[]): AgentRuntimeInventoryServiceResult {
  return {
    inventory: { rows },
    snapshot: {
      existingPaths: [],
      availableCommands: [],
    },
    diagnostics: [],
    loadedAt,
  };
}

function readyTargetResult(): AgentRuntimeRedactedSessionTargetListResult {
  return {
    status: 'ready',
    targets: [
      {
        id: 'target-1',
        label: 'Session target 1',
        summary: 'Redacted session metadata',
        targetPath: '/Users/example/.codex/sessions/secret-session-a.jsonl',
        rootPath: '/Users/example/.codex/sessions',
        byteLength: 1234,
        modifiedAt: '2026-06-23T01:00:00.000Z',
      },
    ],
    maxTargets: 20,
    maxDepth: 1,
    contentRedacted: true,
    targetNamesRedacted: true,
    blockedReasons: [],
  };
}

describe('F78 Agent Runtime session target hydration', () => {
  it('hydrates rows with ready redacted session targets without leaking target names into visible fields', async () => {
    const rows = mapAgentRuntimeInventoryRows(
      serviceResult([
        toolRow({
          paths: [
            pathObservation({
              kind: 'sessions-root',
              path: '/Users/example/.codex/sessions',
            }),
          ],
        }),
      ]),
    );
    const lister = vi.fn(async () => readyTargetResult());

    const result = await hydrateAgentRuntimeRowsWithSessionTargets(rows, lister);

    expect(lister).toHaveBeenCalledWith({
      approved: true,
      rootPaths: ['/Users/example/.codex/sessions'],
      maxTargets: 20,
      maxDepth: 1,
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.rows[0].payload.agentRuntime).toMatchObject({
      sessionTargets: readyTargetResult().targets,
    });

    const visibleFields = JSON.stringify({
      name: result.rows[0].name,
      statusLabel: result.rows[0].statusLabel,
      notes: result.rows[0].notes,
      badges: result.rows[0].badges,
      installPath: result.rows[0].installPath,
    });
    expect(visibleFields).not.toContain('secret-session-a');
    expect(visibleFields).not.toContain('jsonl');
  });

  it('does not call the lister when rows have no existing sessions root', async () => {
    const rows = mapAgentRuntimeInventoryRows(
      serviceResult([
        toolRow({
          paths: [
            pathObservation({
              kind: 'config-root',
              path: '/Users/example/.codex',
            }),
          ],
        }),
      ]),
    );
    const lister = vi.fn(async () => readyTargetResult());

    const result = await hydrateAgentRuntimeRowsWithSessionTargets(rows, lister);

    expect(lister).not.toHaveBeenCalled();
    expect(result.rows).toBe(rows);
    expect(result.diagnostics).toEqual([]);
  });

  it('preserves rows and records diagnostics when the lister blocks', async () => {
    const rows = mapAgentRuntimeInventoryRows(
      serviceResult([
        toolRow({
          paths: [
            pathObservation({
              kind: 'sessions-root',
              path: '/Users/example/.codex/sessions',
            }),
          ],
        }),
      ]),
    );
    const lister = vi.fn(async (): Promise<AgentRuntimeRedactedSessionTargetListResult> => ({
      status: 'blocked',
      targets: [],
      maxTargets: 20,
      maxDepth: 1,
      contentRedacted: true,
      targetNamesRedacted: true,
      blockedReasons: ['Explicit approval is required.'],
    }));

    const result = await hydrateAgentRuntimeRowsWithSessionTargets(rows, lister);

    expect(result.rows).toEqual(rows);
    expect(result.diagnostics).toEqual([
      {
        code: 'session_target_list_failed',
        severity: 'warning',
        message: 'Session target listing blocked for Codex CLI: Explicit approval is required.',
      },
    ]);
  });

  it('preserves rows and redacts unsafe thrown lister errors', async () => {
    const rows = mapAgentRuntimeInventoryRows(
      serviceResult([
        toolRow({
          paths: [
            pathObservation({
              kind: 'sessions-root',
              path: '/Users/example/.codex/sessions',
            }),
          ],
        }),
      ]),
    );
    const lister = vi.fn(async () => {
      throw new Error('secret-session-a.jsonl leaked api_key=sk-unsafe');
    });

    const result = await hydrateAgentRuntimeRowsWithSessionTargets(rows, lister);

    expect(result.rows).toEqual(rows);
    expect(result.diagnostics).toEqual([
      {
        code: 'session_target_list_failed',
        severity: 'warning',
        message: 'Session target listing failed for Codex CLI; error details redacted.',
      },
    ]);
    expect(JSON.stringify(result.diagnostics)).not.toContain('secret-session-a');
    expect(JSON.stringify(result.diagnostics)).not.toContain('sk-unsafe');
  });
});
