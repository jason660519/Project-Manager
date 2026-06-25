import { describe, expect, it } from 'vitest';
import { buildAgentRuntimeSessionImportPreview } from '../../../../lib/agent-runtime/sessionImportPreview';
import { buildAgentRuntimeDetailModel } from '../../../../lib/integrations/mappers/agent-runtime-detail';
import type { AgentRuntimeToolRow } from '../../../../lib/agent-runtime';
import type { IntegrationRow } from '../../../../lib/integrations/types';

function runtimeRow(overrides: Partial<AgentRuntimeToolRow> = {}): AgentRuntimeToolRow {
  return {
    rowId: 'agent-runtime:codex',
    toolId: 'codex',
    label: 'Codex CLI',
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
        kind: 'sessions-root',
        path: '/Users/example/.codex/sessions',
        exists: true,
        required: false,
        secretBearing: false,
        childCount: 3,
      },
      {
        kind: 'sessions-root',
        path: '/Users/example/.codex/archived_sessions',
        exists: true,
        required: false,
        secretBearing: false,
        childCount: 2,
      },
    ],
    warnings: [],
    ...overrides,
  };
}

function integrationRow(tool: AgentRuntimeToolRow): IntegrationRow {
  return {
    rowKey: tool.rowId,
    sheet: 'agent-runtime',
    sourceKind: 'agent-runtime',
    sourceId: tool.toolId,
    enabled: true,
    category1: 'Agent Runtime',
    category2: 'Ready',
    githubUrl: '',
    company: 'Local',
    name: tool.label,
    version: '',
    license: '',
    scope: 'user',
    port: '',
    installPath: '/Users/example/.codex',
    installMethod: 'system_path',
    status: 'installed',
    statusLabel: 'Ready',
    lastUpdated: '2026-06-22T21:20:00.000Z',
    notes: 'codex command available.',
    lv: null,
    badges: ['sessions'],
    payload: {
      loadedAt: '2026-06-22T21:20:00.000Z',
      diagnostics: [],
      agentRuntime: tool,
    },
  };
}

describe('count-aware Agent Runtime session import preview copy', () => {
  it('summarizes ready roots with aggregate artifact candidate counts', () => {
    const preview = buildAgentRuntimeSessionImportPreview(runtimeRow());

    expect(preview.summary).toBe('Session import preview: 2 metadata-only root(s) ready with 5 artifact candidate(s).');
  });

  it('keeps root-only copy when child count metadata is absent', () => {
    const preview = buildAgentRuntimeSessionImportPreview(
      runtimeRow({
        paths: runtimeRow().paths.map(({ childCount: _childCount, ...path }) => path),
      }),
    );

    expect(preview.summary).toBe('Session import preview: 2 metadata-only root(s) ready.');
  });

  it('keeps blocked reasons explicit in summary copy', () => {
    const preview = buildAgentRuntimeSessionImportPreview(
      runtimeRow({
        paths: runtimeRow().paths.map((path) => ({ ...path, exists: false })),
      }),
    );

    expect(preview.summary).toBe('Session import preview: blocked. No existing session root was detected.');
  });

  it('does not expose filenames, transcript text, or secret-like fixture fields', () => {
    const row = runtimeRow() as AgentRuntimeToolRow & {
      transcriptText?: string;
      rawSecret?: string;
      filenames?: string[];
    };
    row.transcriptText = 'private transcript text';
    row.rawSecret = 'OPENAI_API_KEY=bad';
    row.filenames = ['session-a.json', 'session-b.json'];

    const displayText = JSON.stringify(buildAgentRuntimeSessionImportPreview(row));

    expect(displayText).toContain('5 artifact candidate');
    expect(displayText).not.toContain('private transcript text');
    expect(displayText).not.toContain('OPENAI_API_KEY=bad');
    expect(displayText).not.toContain('session-a.json');
    expect(displayText).not.toContain('session-b.json');
  });

  it('feeds Session detail group copy through preview summary', () => {
    const detail = buildAgentRuntimeDetailModel(integrationRow(runtimeRow()));
    const sessionGroup = detail?.groups.find((group) => group.id === 'sessions');

    expect(sessionGroup?.details).toContain(
      'Session import preview: 2 metadata-only root(s) ready with 5 artifact candidate(s).',
    );
  });
});
