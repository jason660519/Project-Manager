import { describe, expect, it } from 'vitest';
import { buildAgentRuntimeDetailModel } from '../../../../lib/integrations/mappers/agent-runtime-detail';
import type { IntegrationRow } from '../../../../lib/integrations/types';

function agentRuntimeRow(overrides: Partial<IntegrationRow> = {}): IntegrationRow {
  return {
    rowKey: 'agent-runtime:codex',
    sheet: 'agent-runtime',
    sourceKind: 'agent-runtime',
    sourceId: 'codex',
    enabled: true,
    category1: 'Agent Runtime',
    category2: 'Partial',
    githubUrl: '',
    company: 'Local',
    name: 'Codex',
    version: '',
    license: '',
    scope: 'user',
    port: '',
    installPath: '/Users/example/.codex',
    installMethod: 'system_path',
    status: 'warning',
    statusLabel: 'Partial',
    lastUpdated: '2026-06-22T10:00:00.000Z',
    notes: 'codex command available. 4 path evidence item(s).',
    lv: null,
    badges: ['mcp', 'skills', 'sessions'],
    payload: {
      loadedAt: '2026-06-22T10:00:00.000Z',
      diagnostics: [],
      agentRuntime: {
        rowId: 'agent-runtime:codex',
        toolId: 'codex',
        label: 'Codex',
        command: 'codex',
        commandAvailable: true,
        status: 'partial',
        capabilities: {
          mcp: true,
          skills: true,
          sessions: true,
          cost: false,
        },
        paths: [
          {
            kind: 'config-root',
            path: '/Users/example/.codex',
            exists: true,
            required: false,
            secretBearing: false,
          },
          {
            kind: 'mcp-file',
            path: '/Users/example/.codex/mcp.json',
            exists: true,
            required: false,
            secretBearing: false,
          },
          {
            kind: 'skills-root',
            path: '/Users/example/.codex/skills',
            exists: true,
            required: false,
            secretBearing: false,
          },
          {
            kind: 'sessions-root',
            path: '/Users/example/.codex/sessions',
            exists: false,
            required: false,
            secretBearing: false,
          },
          {
            kind: 'config-file',
            path: '/Users/example/.codex/auth.json',
            exists: true,
            required: false,
            secretBearing: true,
          },
        ],
        warnings: [],
      },
    },
    ...overrides,
  };
}

describe('buildAgentRuntimeDetailModel', () => {
  it('builds five read-only readiness groups from Agent Runtime row evidence', () => {
    const detail = buildAgentRuntimeDetailModel(agentRuntimeRow());

    expect(detail?.title).toBe('Codex');
    expect(detail?.command).toEqual({ label: 'codex', available: true });
    expect(detail?.groups.map((group) => group.id)).toEqual([
      'runtime',
      'mcp',
      'skills',
      'sessions',
      'cost',
    ]);
    expect(detail?.groups.find((group) => group.id === 'mcp')?.state).toBe('ready');
    expect(detail?.groups.find((group) => group.id === 'skills')?.evidence[0]?.path).toBe(
      '/Users/example/.codex/skills',
    );
    expect(detail?.groups.find((group) => group.id === 'cost')?.state).toBe('missing');
  });

  it('keeps missing evidence, warnings, and diagnostics visible for troubleshooting', () => {
    const detail = buildAgentRuntimeDetailModel(
      agentRuntimeRow({
        payload: {
          loadedAt: '2026-06-22T10:00:00.000Z',
          diagnostics: [
            {
              code: 'snapshot_load_failed',
              severity: 'warning',
              message: 'Snapshot bridge unavailable in browser preview.',
            },
          ],
          agentRuntime: {
            rowId: 'agent-runtime:codex',
            toolId: 'codex',
            label: 'Codex',
            command: 'codex',
            commandAvailable: false,
            status: 'missing',
            capabilities: {
              mcp: false,
              skills: false,
              sessions: false,
              cost: false,
            },
            paths: [],
            warnings: [
              {
                code: 'missing_command',
                severity: 'warning',
                message: 'codex command was not found on PATH.',
              },
            ],
          },
        },
      }),
    );

    expect(detail?.status).toBe('missing');
    expect(detail?.command.available).toBe(false);
    expect(detail?.warnings).toHaveLength(1);
    expect(detail?.diagnostics).toHaveLength(1);
    expect(detail?.groups.every((group) => group.state === 'missing')).toBe(true);
  });

  it('does not expose file contents or secret-like payload fields in displayable text', () => {
    const detail = buildAgentRuntimeDetailModel(
      agentRuntimeRow({
        payload: {
          loadedAt: '2026-06-22T10:00:00.000Z',
          diagnostics: [],
          fileContents: 'sk-ant-secret-from-bad-payload',
          rawSecret: 'OPENAI_API_KEY=bad',
          agentRuntime: {
            rowId: 'agent-runtime:codex',
            toolId: 'codex',
            label: 'Codex',
            command: 'codex',
            commandAvailable: true,
            status: 'partial',
            capabilities: {
              mcp: true,
              skills: false,
              sessions: false,
              cost: false,
            },
            paths: [
              {
                kind: 'config-file',
                path: '/Users/example/.codex/auth.json',
                exists: true,
                required: false,
                secretBearing: true,
              },
            ],
            warnings: [],
          },
        },
      }),
    );

    const displayText = JSON.stringify(detail);

    expect(displayText).toContain('/Users/example/.codex/auth.json');
    expect(displayText).toContain('secretBearing');
    expect(displayText).not.toContain('sk-ant-secret-from-bad-payload');
    expect(displayText).not.toContain('OPENAI_API_KEY=bad');
  });

  it('returns null for non Agent Runtime rows', () => {
    expect(
      buildAgentRuntimeDetailModel(
        agentRuntimeRow({
          sheet: 'skills',
          sourceKind: 'skill',
        }),
      ),
    ).toBeNull();
  });
});
