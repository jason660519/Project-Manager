import { describe, expect, it } from 'vitest';

import {
  buildAgentRuntimeSessionEnvelopeSummary,
  type AgentRuntimeSessionEnvelopeSummaryInput,
} from '../../../../lib/agent-runtime/sessionEnvelopeSummary';
import { buildAgentRuntimeDetailModel } from '../../../../lib/integrations/mappers/agent-runtime-detail';
import type { AgentRuntimeToolRow } from '../../../../lib/agent-runtime';
import type { IntegrationRow } from '../../../../lib/integrations/types';

function readyEnvelope(
  overrides: Partial<AgentRuntimeSessionEnvelopeSummaryInput> = {},
): AgentRuntimeSessionEnvelopeSummaryInput {
  return {
    status: 'ready',
    contentRedacted: true,
    targetNameRedacted: true,
    byteLength: 2048,
    maxBytes: 4096,
    blockedReasons: [],
    envelope: {
      messageCount: 5,
      userMessageCount: 2,
      assistantMessageCount: 2,
      toolMessageCount: 1,
      otherMessageCount: 0,
      toolCallCount: 3,
    },
    ...overrides,
  };
}

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

function integrationRow(
  tool: AgentRuntimeToolRow,
  sessionEnvelope?: AgentRuntimeSessionEnvelopeSummaryInput,
): IntegrationRow {
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
    lastUpdated: '2026-06-23T08:10:00.000Z',
    notes: 'codex command available.',
    lv: null,
    badges: ['sessions'],
    payload: {
      loadedAt: '2026-06-23T08:10:00.000Z',
      diagnostics: [],
      agentRuntime: {
        ...tool,
        ...(sessionEnvelope ? { sessionEnvelope } : {}),
      },
    },
  };
}

describe('F72 Agent Runtime session envelope summary', () => {
  it('summarizes ready aggregate envelope counts without content', () => {
    const summary = buildAgentRuntimeSessionEnvelopeSummary(readyEnvelope());

    expect(summary).toBe(
      'Session envelope: 5 message(s) parsed (user 2, assistant 2, tool 1, other 0); 3 tool call(s). Content and target names redacted.',
    );
  });

  it('returns no summary when aggregate envelope metadata is absent', () => {
    expect(buildAgentRuntimeSessionEnvelopeSummary(null)).toBeNull();
    expect(buildAgentRuntimeDetailModel(integrationRow(runtimeRow()))?.groups.find((group) => group.id === 'sessions')?.details).toEqual([
      'Session import preview: 2 metadata-only root(s) ready with 5 artifact candidate(s).',
      'Session import dry run: 2 root(s) would be scanned as metadata only with 5 artifact candidate(s).',
      'Session import approval: needs approval. Review and explicitly approve the metadata-only dry run before reading transcripts.',
      'Session envelope parse action: needs approval. Review and explicitly approve the metadata-only dry run before reading transcripts.',
    ]);
  });

  it('summarizes blocked aggregate envelope state without inventing counts', () => {
    const summary = buildAgentRuntimeSessionEnvelopeSummary({
      status: 'blocked',
      contentRedacted: true,
      targetNameRedacted: true,
      maxBytes: 4096,
      envelope: null,
      blockedReasons: ['Approval is required before reading session content.'],
    });

    expect(summary).toBe(
      'Session envelope: blocked. Approval is required before reading session content.',
    );
  });

  it('keeps renderer-visible output free of transcript text, filenames, tool args, and secrets', () => {
    const unsafeFixture = {
      ...readyEnvelope(),
      transcriptText: 'private transcript text',
      filename: 'session-a.json',
      toolArguments: 'cat secret.txt',
      rawSecret: 'OPENAI_API_KEY=bad',
    };

    const displayText = JSON.stringify(buildAgentRuntimeSessionEnvelopeSummary(unsafeFixture));

    expect(displayText).toContain('5 message');
    expect(displayText).not.toContain('private transcript text');
    expect(displayText).not.toContain('session-a.json');
    expect(displayText).not.toContain('cat secret.txt');
    expect(displayText).not.toContain('OPENAI_API_KEY=bad');
  });

  it('adds aggregate envelope copy after the existing Session import boundary details', () => {
    const detail = buildAgentRuntimeDetailModel(integrationRow(runtimeRow(), readyEnvelope()));
    const sessionGroup = detail?.groups.find((group) => group.id === 'sessions');

    expect(sessionGroup?.details).toEqual([
      'Session import preview: 2 metadata-only root(s) ready with 5 artifact candidate(s).',
      'Session import dry run: 2 root(s) would be scanned as metadata only with 5 artifact candidate(s).',
      'Session import approval: needs approval. Review and explicitly approve the metadata-only dry run before reading transcripts.',
      'Session envelope parse action: needs approval. Review and explicitly approve the metadata-only dry run before reading transcripts.',
      'Session envelope: 5 message(s) parsed (user 2, assistant 2, tool 1, other 0); 3 tool call(s). Content and target names redacted.',
    ]);
  });
});
