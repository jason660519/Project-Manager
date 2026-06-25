import { describe, expect, it } from 'vitest';
import { buildAgentRuntimeSessionImportPreview } from '../../../../lib/agent-runtime/sessionImportPreview';
import { buildAgentRuntimeSessionImportDryRun } from '../../../../lib/agent-runtime/sessionImportDryRun';
import { buildAgentRuntimeSessionImportApproval } from '../../../../lib/agent-runtime/sessionImportApproval';
import { buildAgentRuntimeDetailModel } from '../../../../lib/integrations/mappers/agent-runtime-detail';
import type { AgentRuntimeSessionImportDryRun } from '../../../../lib/agent-runtime/sessionImportDryRun';
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
    lastUpdated: '2026-06-22T21:40:00.000Z',
    notes: 'codex command available.',
    lv: null,
    badges: ['sessions'],
    payload: {
      loadedAt: '2026-06-22T21:40:00.000Z',
      diagnostics: [],
      agentRuntime: tool,
    },
  };
}

function dryRunFor(row: AgentRuntimeToolRow): AgentRuntimeSessionImportDryRun {
  return buildAgentRuntimeSessionImportDryRun(buildAgentRuntimeSessionImportPreview(row));
}

describe('Agent Runtime session import approval boundary', () => {
  it('creates a future reader request only after a ready dry run is approved', () => {
    const approval = buildAgentRuntimeSessionImportApproval(dryRunFor(runtimeRow()), {
      approved: true,
      approvedBy: 'operator',
    });

    expect(approval.status).toBe('approved');
    expect(approval.summary).toBe('Session import approval: approved for 2 root(s) with 5 artifact candidate(s).');
    expect(approval.readerRequest).toEqual({
      toolId: 'codex',
      label: 'Codex CLI',
      mode: 'transcript_reader_pending',
      rootPaths: ['/Users/example/.codex/sessions', '/Users/example/.codex/archived_sessions'],
      artifactCandidateCount: 5,
      approvedBy: 'operator',
    });
    expect(approval.blockedReasons).toEqual([]);
  });

  it('keeps artifact count unknown when an approved dry run has no count metadata', () => {
    const approval = buildAgentRuntimeSessionImportApproval(
      dryRunFor(
        runtimeRow({
          paths: runtimeRow().paths.map(({ childCount: _childCount, ...path }) => path),
        }),
      ),
      { approved: true },
    );

    expect(approval.status).toBe('approved');
    expect(approval.summary).toBe('Session import approval: approved for 2 root(s).');
    expect(approval.readerRequest?.artifactCandidateCount).toBeNull();
  });

  it('requires explicit approval before producing a reader request', () => {
    const approval = buildAgentRuntimeSessionImportApproval(dryRunFor(runtimeRow()), {
      approved: false,
    });

    expect(approval.status).toBe('needs_approval');
    expect(approval.readerRequest).toBeNull();
    expect(approval.blockedReasons).toEqual(['Review and explicitly approve the metadata-only dry run before reading transcripts.']);
    expect(approval.summary).toBe('Session import approval: needs approval. Review and explicitly approve the metadata-only dry run before reading transcripts.');
  });

  it('keeps blocked dry runs from producing a reader request', () => {
    const approval = buildAgentRuntimeSessionImportApproval(
      dryRunFor(
        runtimeRow({
          paths: runtimeRow().paths.map((path) => ({ ...path, exists: false })),
        }),
      ),
      { approved: true },
    );

    expect(approval.status).toBe('blocked');
    expect(approval.readerRequest).toBeNull();
    expect(approval.blockedReasons).toEqual(['No existing session root was detected.']);
    expect(approval.summary).toBe('Session import approval: blocked. No existing session root was detected.');
  });

  it('keeps unsupported dry runs from producing a reader request', () => {
    const approval = buildAgentRuntimeSessionImportApproval(
      dryRunFor(
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
      { approved: true },
    );

    expect(approval.status).toBe('unsupported');
    expect(approval.readerRequest).toBeNull();
    expect(approval.blockedReasons).toEqual(['Runtime does not advertise session import support.']);
    expect(approval.summary).toBe('Session import approval: unsupported. Runtime does not advertise session import support.');
  });

  it('does not expose filenames, transcript text, or secret-like fixture fields', () => {
    const dryRun = dryRunFor(runtimeRow()) as AgentRuntimeSessionImportDryRun & {
      transcriptText?: string;
      rawSecret?: string;
      filenames?: string[];
    };
    dryRun.transcriptText = 'private transcript text';
    dryRun.rawSecret = 'OPENAI_API_KEY=bad';
    dryRun.filenames = ['session-a.json', 'session-b.json'];

    const displayText = JSON.stringify(
      buildAgentRuntimeSessionImportApproval(dryRun, { approved: true, approvedBy: 'operator' }),
    );

    expect(displayText).toContain('5 artifact candidate');
    expect(displayText).toContain('/Users/example/.codex/sessions');
    expect(displayText).not.toContain('private transcript text');
    expect(displayText).not.toContain('OPENAI_API_KEY=bad');
    expect(displayText).not.toContain('session-a.json');
    expect(displayText).not.toContain('session-b.json');
  });

  it('feeds Session detail group copy through the shared approval boundary', () => {
    const detail = buildAgentRuntimeDetailModel(integrationRow(runtimeRow()));
    const sessionGroup = detail?.groups.find((group) => group.id === 'sessions');

    expect(sessionGroup?.details).toEqual([
      'Session import preview: 2 metadata-only root(s) ready with 5 artifact candidate(s).',
      'Session import dry run: 2 root(s) would be scanned as metadata only with 5 artifact candidate(s).',
      'Session import approval: needs approval. Review and explicitly approve the metadata-only dry run before reading transcripts.',
      'Session envelope parse action: needs approval. Review and explicitly approve the metadata-only dry run before reading transcripts.',
    ]);
  });
});
