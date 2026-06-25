import { describe, expect, it } from 'vitest';
import { buildAgentRuntimeSessionCostSummary } from '../../../../lib/agent-runtime/sessionCostSummary';
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
        kind: 'config-root',
        path: '/Users/example/.codex',
        exists: true,
        required: true,
        secretBearing: false,
      },
      {
        kind: 'sessions-root',
        path: '/Users/example/.codex/sessions',
        exists: true,
        required: false,
        secretBearing: false,
      },
      {
        kind: 'sessions-root',
        path: '/Users/example/.codex/archived_sessions',
        exists: false,
        required: false,
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
    lastUpdated: '2026-06-22T20:30:00.000Z',
    notes: 'codex command available.',
    lv: null,
    badges: ['sessions', 'cost'],
    payload: {
      loadedAt: '2026-06-22T20:30:00.000Z',
      diagnostics: [],
      agentRuntime: tool,
    },
  };
}

describe('buildAgentRuntimeSessionCostSummary', () => {
  it('marks session and cost evidence ready when a cost-capable runtime has an existing session root', () => {
    const summary = buildAgentRuntimeSessionCostSummary(runtimeRow());

    expect(summary.session.state).toBe('ready');
    expect(summary.session.candidateRootCount).toBe(2);
    expect(summary.session.existingRootCount).toBe(1);
    expect(summary.session.roots.map((root) => root.path)).toEqual([
      '/Users/example/.codex/sessions',
      '/Users/example/.codex/archived_sessions',
    ]);
    expect(summary.cost.state).toBe('evidence_available');
    expect(summary.cost.source).toBe('session-root');
  });

  it('keeps missing session evidence explicit instead of marking cost ready', () => {
    const summary = buildAgentRuntimeSessionCostSummary(
      runtimeRow({
        paths: runtimeRow().paths.map((path) =>
          path.kind === 'sessions-root' ? { ...path, exists: false } : path,
        ),
      }),
    );

    expect(summary.session.state).toBe('missing');
    expect(summary.session.existingRootCount).toBe(0);
    expect(summary.cost.state).toBe('missing_session_evidence');
    expect(summary.cost.reason).toContain('No existing session root');
  });

  it('marks cost unsupported when the runtime has no cost capability', () => {
    const summary = buildAgentRuntimeSessionCostSummary(
      runtimeRow({
        toolId: 'claude-code',
        label: 'Claude Code',
        capabilities: {
          runtime: true,
          mcp: true,
          skills: true,
          sessions: true,
          cost: false,
        },
      }),
    );

    expect(summary.session.state).toBe('ready');
    expect(summary.cost.state).toBe('unsupported');
    expect(summary.cost.source).toBe('none');
  });

  it('does not expose secret-like fields, session transcript text, or secret-bearing config contents', () => {
    const row = runtimeRow({
      paths: [
        ...runtimeRow().paths,
        {
          kind: 'config-file',
          path: '/Users/example/.codex/session.json',
          exists: true,
          required: false,
          secretBearing: false,
        },
      ],
    }) as AgentRuntimeToolRow & {
      fileContents?: string;
      transcriptText?: string;
      rawSecret?: string;
    };
    row.fileContents = 'sk-ant-secret-from-session-file';
    row.transcriptText = 'private user transcript';
    row.rawSecret = 'OPENAI_API_KEY=bad';

    const displayText = JSON.stringify(buildAgentRuntimeSessionCostSummary(row));

    expect(displayText).toContain('/Users/example/.codex/sessions');
    expect(displayText).not.toContain('sk-ant-secret-from-session-file');
    expect(displayText).not.toContain('private user transcript');
    expect(displayText).not.toContain('OPENAI_API_KEY=bad');
    expect(displayText).not.toContain('/Users/example/.codex/auth.json');
  });

  it('feeds Session and Cost detail group summaries through the shared summary contract', () => {
    const detail = buildAgentRuntimeDetailModel(integrationRow(runtimeRow()));

    expect(detail?.groups.find((group) => group.id === 'sessions')?.summary).toContain(
      '1 of 2 session root(s) detected',
    );
    expect(detail?.groups.find((group) => group.id === 'cost')?.summary).toContain(
      'Session evidence is available for future cost import.',
    );
  });
});
