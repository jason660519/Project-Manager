import { describe, expect, it } from 'vitest';

import {
  buildAgentRuntimeSessionEnvelopeParseAction,
  type AgentRuntimeSessionEnvelopeParseActionInput,
} from '../../../../lib/agent-runtime/sessionEnvelopeParseAction';
import { buildAgentRuntimeSessionImportApproval } from '../../../../lib/agent-runtime/sessionImportApproval';
import { buildAgentRuntimeSessionImportDryRun } from '../../../../lib/agent-runtime/sessionImportDryRun';
import { buildAgentRuntimeSessionImportPreview } from '../../../../lib/agent-runtime/sessionImportPreview';
import { buildAgentRuntimeDetailModel } from '../../../../lib/integrations/mappers/agent-runtime-detail';
import type { AgentRuntimeSessionImportApproval } from '../../../../lib/agent-runtime/sessionImportApproval';
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

function approvalFor(row: AgentRuntimeToolRow, approved: boolean): AgentRuntimeSessionImportApproval {
  return buildAgentRuntimeSessionImportApproval(
    buildAgentRuntimeSessionImportDryRun(buildAgentRuntimeSessionImportPreview(row)),
    approved ? { approved: true, approvedBy: 'operator' } : { approved: false },
  );
}

function input(
  overrides: Partial<AgentRuntimeSessionEnvelopeParseActionInput> = {},
): AgentRuntimeSessionEnvelopeParseActionInput {
  return {
    approval: approvalFor(runtimeRow(), true),
    parseConfirmed: true,
    targetPath: '/Users/example/.codex/sessions/session-a.json',
    maxBytes: 65536,
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
    lastUpdated: '2026-06-23T08:30:00.000Z',
    notes: 'codex command available.',
    lv: null,
    badges: ['sessions'],
    payload: {
      loadedAt: '2026-06-23T08:30:00.000Z',
      diagnostics: [],
      agentRuntime: tool,
    },
  };
}

describe('F73 Agent Runtime approved session envelope parse action', () => {
  it('builds a parser request only after approval and explicit parse confirmation', () => {
    const action = buildAgentRuntimeSessionEnvelopeParseAction(input());

    expect(action.status).toBe('ready');
    expect(action.summary).toBe(
      'Session envelope parse action: ready for one selected target across 2 approved root(s); max 65536 byte(s). Target name redacted.',
    );
    expect(action.parseRequest).toEqual({
      approved: true,
      rootPaths: ['/Users/example/.codex/sessions', '/Users/example/.codex/archived_sessions'],
      targetPath: '/Users/example/.codex/sessions/session-a.json',
      maxBytes: 65536,
    });
    expect(action.blockedReasons).toEqual([]);
  });

  it('requires the F68 approval boundary before producing a parser request', () => {
    const action = buildAgentRuntimeSessionEnvelopeParseAction(
      input({
        approval: approvalFor(runtimeRow(), false),
      }),
    );

    expect(action.status).toBe('needs_approval');
    expect(action.parseRequest).toBeNull();
    expect(action.blockedReasons).toEqual([
      'Review and explicitly approve the metadata-only dry run before reading transcripts.',
    ]);
    expect(action.summary).toBe(
      'Session envelope parse action: needs approval. Review and explicitly approve the metadata-only dry run before reading transcripts.',
    );
  });

  it('requires explicit parse confirmation even when the reader boundary is approved', () => {
    const action = buildAgentRuntimeSessionEnvelopeParseAction(
      input({
        parseConfirmed: false,
      }),
    );

    expect(action.status).toBe('needs_approval');
    expect(action.parseRequest).toBeNull();
    expect(action.blockedReasons).toEqual([
      'Confirm envelope parsing after reviewing the approved reader boundary.',
    ]);
  });

  it('blocks missing target paths and invalid max byte limits', () => {
    const missingTarget = buildAgentRuntimeSessionEnvelopeParseAction(input({ targetPath: '   ' }));
    const invalidBytes = buildAgentRuntimeSessionEnvelopeParseAction(input({ maxBytes: 0 }));

    expect(missingTarget.status).toBe('blocked');
    expect(missingTarget.parseRequest).toBeNull();
    expect(missingTarget.blockedReasons).toEqual(['Select one session target before parsing its envelope.']);

    expect(invalidBytes.status).toBe('blocked');
    expect(invalidBytes.parseRequest).toBeNull();
    expect(invalidBytes.blockedReasons).toEqual(['Set a positive finite max byte limit before parsing.']);
  });

  it('preserves blocked and unsupported approval states without creating a parser request', () => {
    const blocked = buildAgentRuntimeSessionEnvelopeParseAction(
      input({
        approval: approvalFor(
          runtimeRow({
            paths: runtimeRow().paths.map((path) => ({ ...path, exists: false })),
          }),
          true,
        ),
      }),
    );
    const unsupported = buildAgentRuntimeSessionEnvelopeParseAction(
      input({
        approval: approvalFor(
          runtimeRow({
            capabilities: {
              runtime: true,
              mcp: false,
              skills: false,
              sessions: false,
              cost: false,
            },
          }),
          true,
        ),
      }),
    );

    expect(blocked.status).toBe('blocked');
    expect(blocked.parseRequest).toBeNull();
    expect(blocked.blockedReasons).toEqual(['No existing session root was detected.']);

    expect(unsupported.status).toBe('unsupported');
    expect(unsupported.parseRequest).toBeNull();
    expect(unsupported.blockedReasons).toEqual(['Runtime does not advertise session import support.']);
  });

  it('keeps display-safe output free of target filenames, transcript text, tool args, and secrets', () => {
    const action = buildAgentRuntimeSessionEnvelopeParseAction({
      ...input(),
      transcriptText: 'private transcript text',
      targetFilename: 'session-a.json',
      toolArguments: 'cat secret.txt',
      rawSecret: 'OPENAI_API_KEY=bad',
    });

    const displayText = JSON.stringify({
      status: action.status,
      summary: action.summary,
      blockedReasons: action.blockedReasons,
    });

    expect(displayText).toContain('ready');
    expect(displayText).not.toContain('private transcript text');
    expect(displayText).not.toContain('session-a.json');
    expect(displayText).not.toContain('cat secret.txt');
    expect(displayText).not.toContain('OPENAI_API_KEY=bad');
  });

  it('surfaces the guarded parse action state in the Agent Runtime Session detail group', () => {
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
