import { describe, expect, it } from 'vitest';
import { buildAgentRuntimeSessionImportPreview } from '../../../../lib/agent-runtime/sessionImportPreview';
import { buildAgentRuntimeSessionImportDryRun } from '../../../../lib/agent-runtime/sessionImportDryRun';
import { buildAgentRuntimeDetailModel } from '../../../../lib/integrations/mappers/agent-runtime-detail';
import type { AgentRuntimeSessionImportPreview } from '../../../../lib/agent-runtime/sessionImportPreview';
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
    lastUpdated: '2026-06-22T21:30:00.000Z',
    notes: 'codex command available.',
    lv: null,
    badges: ['sessions'],
    payload: {
      loadedAt: '2026-06-22T21:30:00.000Z',
      diagnostics: [],
      agentRuntime: tool,
    },
  };
}

function previewFor(row: AgentRuntimeToolRow): AgentRuntimeSessionImportPreview {
  return buildAgentRuntimeSessionImportPreview(row);
}

describe('Agent Runtime session import dry-run contract', () => {
  it('builds a ready metadata-only dry-run plan with aggregate artifact candidates', () => {
    const dryRun = buildAgentRuntimeSessionImportDryRun(previewFor(runtimeRow()));

    expect(dryRun.status).toBe('ready');
    expect(dryRun.summary).toBe('Session import dry run: 2 root(s) would be scanned as metadata only with 5 artifact candidate(s).');
    expect(dryRun.artifactCandidateCount).toBe(5);
    expect(dryRun.planItems).toEqual([
      {
        rootPath: '/Users/example/.codex/sessions',
        importMode: 'metadata_only',
        artifactCandidateCount: 3,
      },
      {
        rootPath: '/Users/example/.codex/archived_sessions',
        importMode: 'metadata_only',
        artifactCandidateCount: 2,
      },
    ]);
    expect(dryRun.blockedReasons).toEqual([]);
  });

  it('keeps artifact count unknown when preview has no child count metadata', () => {
    const dryRun = buildAgentRuntimeSessionImportDryRun(
      previewFor(
        runtimeRow({
          paths: runtimeRow().paths.map(({ childCount: _childCount, ...path }) => path),
        }),
      ),
    );

    expect(dryRun.status).toBe('ready');
    expect(dryRun.summary).toBe('Session import dry run: 2 root(s) would be scanned as metadata only.');
    expect(dryRun.artifactCandidateCount).toBeNull();
    expect(dryRun.planItems).toEqual([
      {
        rootPath: '/Users/example/.codex/sessions',
        importMode: 'metadata_only',
      },
      {
        rootPath: '/Users/example/.codex/archived_sessions',
        importMode: 'metadata_only',
      },
    ]);
  });

  it('returns a blocked dry run without plan items when no session root exists', () => {
    const dryRun = buildAgentRuntimeSessionImportDryRun(
      previewFor(
        runtimeRow({
          paths: runtimeRow().paths.map((path) => ({ ...path, exists: false })),
        }),
      ),
    );

    expect(dryRun.status).toBe('blocked');
    expect(dryRun.planItems).toEqual([]);
    expect(dryRun.blockedReasons).toEqual(['No existing session root was detected.']);
    expect(dryRun.summary).toBe('Session import dry run: blocked. No existing session root was detected.');
  });

  it('returns an unsupported dry run without plan items for stateless runtimes', () => {
    const dryRun = buildAgentRuntimeSessionImportDryRun(
      previewFor(
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
      ),
    );

    expect(dryRun.status).toBe('unsupported');
    expect(dryRun.planItems).toEqual([]);
    expect(dryRun.blockedReasons).toEqual(['Runtime does not advertise session import support.']);
    expect(dryRun.summary).toBe('Session import dry run: unsupported. Runtime does not advertise session import support.');
  });

  it('does not expose filenames, transcript text, or secret-like fixture fields', () => {
    const preview = previewFor(runtimeRow()) as AgentRuntimeSessionImportPreview & {
      transcriptText?: string;
      rawSecret?: string;
      filenames?: string[];
    };
    preview.transcriptText = 'private transcript text';
    preview.rawSecret = 'OPENAI_API_KEY=bad';
    preview.filenames = ['session-a.json', 'session-b.json'];

    const displayText = JSON.stringify(buildAgentRuntimeSessionImportDryRun(preview));

    expect(displayText).toContain('5 artifact candidate');
    expect(displayText).toContain('/Users/example/.codex/sessions');
    expect(displayText).not.toContain('private transcript text');
    expect(displayText).not.toContain('OPENAI_API_KEY=bad');
    expect(displayText).not.toContain('session-a.json');
    expect(displayText).not.toContain('session-b.json');
  });

  it('feeds Session detail group copy through the shared dry-run contract', () => {
    const detail = buildAgentRuntimeDetailModel(integrationRow(runtimeRow()));
    const sessionGroup = detail?.groups.find((group) => group.id === 'sessions');

    expect(sessionGroup?.details).toContain(
      'Session import dry run: 2 root(s) would be scanned as metadata only with 5 artifact candidate(s).',
    );
  });
});
