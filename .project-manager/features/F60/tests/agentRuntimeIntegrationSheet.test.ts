import { describe, expect, it } from 'vitest';

import { INTEGRATION_INVENTORY_SHEETS, INTEGRATION_SHEET_ACTION_LABELS } from '../../../../lib/integrations/sheet-actions';
import { INTEGRATION_SHEETS } from '../../../../lib/integrations/types';
import { mapAgentRuntimeInventoryRows } from '../../../../lib/integrations/mappers/agent-runtime';
import type { AgentRuntimeToolRow } from '../../../../lib/agent-runtime';

function runtimeRow(overrides: Partial<AgentRuntimeToolRow> = {}): AgentRuntimeToolRow {
  return {
    rowId: 'agent-runtime:codex',
    toolId: 'codex',
    label: 'Codex',
    command: 'codex',
    commandAvailable: true,
    status: 'ready',
    capabilities: {
      runtime: true,
      mcp: true,
      skills: true,
      sessions: true,
      cost: true,
    },
    paths: [
      {
        kind: 'config-root',
        path: '/Users/example/.codex',
        exists: true,
        required: true,
        secretBearing: false,
      },
      {
        kind: 'secret-file',
        path: '/Users/example/.codex/auth.json',
        exists: true,
        required: false,
        secretBearing: true,
      },
    ],
    warnings: [
      {
        code: 'secret_file_not_parsed',
        severity: 'info',
        message: 'Codex secret-bearing file is present but was not parsed.',
        path: '/Users/example/.codex/auth.json',
      },
    ],
    ...overrides,
  };
}

describe('F60 Agent Runtime Integration Sheet contracts', () => {
  it('maps runtime inventory rows into deterministic IntegrationRow values', () => {
    const rows = mapAgentRuntimeInventoryRows({
      inventory: { rows: [runtimeRow()] },
      snapshot: {
        existingPaths: ['/Users/example/.codex', '/Users/example/.codex/auth.json'],
        availableCommands: ['codex'],
      },
      diagnostics: [],
      loadedAt: '2026-06-23T00:00:00.000Z',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowKey: 'agent-runtime:codex',
      sheet: 'agent-runtime',
      sourceKind: 'agent-runtime',
      sourceId: 'codex',
      enabled: true,
      category1: 'Agent Runtime',
      category2: 'Ready',
      company: 'Local',
      name: 'Codex',
      installMethod: 'system_path',
      status: 'installed',
      statusLabel: 'Ready',
      installPath: '/Users/example/.codex',
      lastUpdated: '2026-06-23T00:00:00.000Z',
    });
    expect(rows[0].badges).toEqual(['runtime', 'mcp', 'skills', 'sessions', 'cost', '1 warning']);
  });

  it('maps runtime statuses to IntegrationStatus values without dropping missing rows', () => {
    const mapped = mapAgentRuntimeInventoryRows({
      inventory: {
        rows: [
          runtimeRow({ toolId: 'ready-tool', rowId: 'agent-runtime:ready-tool', status: 'ready', label: 'Ready Tool' }),
          runtimeRow({ toolId: 'partial-tool', rowId: 'agent-runtime:partial-tool', status: 'partial', label: 'Partial Tool' }),
          runtimeRow({
            toolId: 'missing-tool',
            rowId: 'agent-runtime:missing-tool',
            status: 'missing',
            label: 'Missing Tool',
            commandAvailable: false,
            paths: [],
            warnings: [],
          }),
          runtimeRow({
            toolId: 'unsupported-tool',
            rowId: 'agent-runtime:unsupported-tool',
            status: 'unsupported',
            label: 'Unsupported Tool',
          }),
        ],
      },
      snapshot: { existingPaths: [], availableCommands: [] },
      diagnostics: [],
      loadedAt: '2026-06-23T00:00:00.000Z',
    });

    expect(mapped.map((row) => [row.sourceId, row.status, row.statusLabel])).toEqual([
      ['ready-tool', 'installed', 'Ready'],
      ['partial-tool', 'warning', 'Partial'],
      ['missing-tool', 'not_installed', 'Missing'],
      ['unsupported-tool', 'unavailable', 'Unsupported'],
    ]);
  });

  it('registers agent-runtime as a route-valid and scan-action-valid sheet', () => {
    expect(INTEGRATION_SHEETS).toContain('agent-runtime');
    expect(INTEGRATION_INVENTORY_SHEETS).toContain('agent-runtime');
    expect(INTEGRATION_SHEET_ACTION_LABELS['agent-runtime']).toBe('Agent Runtime');
  });

  it('preserves secret-bearing path metadata without emitting secret values', () => {
    const fakeSecret = 'sk-fake-secret';
    const rows = mapAgentRuntimeInventoryRows({
      inventory: { rows: [runtimeRow()] },
      snapshot: {
        existingPaths: ['/Users/example/.codex/auth.json'],
        availableCommands: [],
        fileContents: {
          '/Users/example/.codex/auth.json': fakeSecret,
        },
      },
      diagnostics: [],
      loadedAt: '2026-06-23T00:00:00.000Z',
    });

    const serialized = JSON.stringify(rows);
    expect(serialized).toContain('/Users/example/.codex/auth.json');
    expect(serialized).not.toContain(fakeSecret);
    expect(serialized).not.toContain('fileContents');
  });
});
