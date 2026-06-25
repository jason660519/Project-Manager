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
    lastUpdated: '2026-06-22T21:00:00.000Z',
    notes: 'codex command available.',
    lv: null,
    badges: ['sessions'],
    payload: {
      loadedAt: '2026-06-22T21:00:00.000Z',
      diagnostics: [],
      agentRuntime: tool,
    },
  };
}

describe('buildAgentRuntimeSessionImportPreview', () => {
  it('marks preview ready when at least one metadata-only session root exists', () => {
    const preview = buildAgentRuntimeSessionImportPreview(runtimeRow());

    expect(preview.state).toBe('ready');
    expect(preview.importableRootCount).toBe(1);
    expect(preview.rootCandidates).toEqual([
      {
        path: '/Users/example/.codex/sessions',
        exists: true,
        importMode: 'metadata_only',
      },
      {
        path: '/Users/example/.codex/archived_sessions',
        exists: false,
        importMode: 'metadata_only',
      },
    ]);
    expect(preview.blockedReasons).toEqual([]);
    expect(preview.nextAction).toBe('Review metadata-only import candidates.');
  });

  it('marks preview blocked when session roots are registered but none exist', () => {
    const preview = buildAgentRuntimeSessionImportPreview(
      runtimeRow({
        paths: runtimeRow().paths.map((path) =>
          path.kind === 'sessions-root' ? { ...path, exists: false } : path,
        ),
      }),
    );

    expect(preview.state).toBe('blocked');
    expect(preview.importableRootCount).toBe(0);
    expect(preview.blockedReasons).toContain('No existing session root was detected.');
    expect(preview.nextAction).toBe('Configure or run the agent once so a session root exists.');
  });

  it('marks preview unsupported when the runtime does not advertise sessions', () => {
    const preview = buildAgentRuntimeSessionImportPreview(
      runtimeRow({
        toolId: 'stateless-runner',
        label: 'Stateless Runner',
        capabilities: {
          runtime: true,
          mcp: false,
          skills: false,
          sessions: false,
          cost: false,
        },
      }),
    );

    expect(preview.state).toBe('unsupported');
    expect(preview.blockedReasons).toContain('Runtime does not advertise session import support.');
    expect(preview.nextAction).toBe('No session import action is available for this runtime.');
  });

  it('does not expose transcript text, raw secrets, or secret-bearing config paths', () => {
    const row = runtimeRow() as AgentRuntimeToolRow & {
      transcriptText?: string;
      fileContents?: string;
      rawSecret?: string;
    };
    row.transcriptText = 'private transcript should not render';
    row.fileContents = 'sk-ant-secret-from-session-preview';
    row.rawSecret = 'OPENAI_API_KEY=bad';

    const displayText = JSON.stringify(buildAgentRuntimeSessionImportPreview(row));

    expect(displayText).toContain('/Users/example/.codex/sessions');
    expect(displayText).not.toContain('/Users/example/.codex/auth.json');
    expect(displayText).not.toContain('private transcript should not render');
    expect(displayText).not.toContain('sk-ant-secret-from-session-preview');
    expect(displayText).not.toContain('OPENAI_API_KEY=bad');
  });

  it('feeds Session group details through the shared preview contract', () => {
    const detail = buildAgentRuntimeDetailModel(integrationRow(runtimeRow()));
    const sessionGroup = detail?.groups.find((group) => group.id === 'sessions');

    expect(sessionGroup?.details).toContain('Session import preview: 1 metadata-only root(s) ready.');
  });
});
