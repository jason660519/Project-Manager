import { describe, expect, it } from 'vitest';

import {
  buildAgentRuntimeSessionEnvelopeParseAction,
  buildAgentRuntimeSessionImportApproval,
  buildAgentRuntimeSessionImportDryRun,
  buildAgentRuntimeSessionImportPreview,
  executeAgentRuntimeSessionEnvelopeParseAction,
  type AgentRuntimeSessionEnvelopeParseExecution,
} from '../../../../lib/agent-runtime';
import type {
  AgentRuntimeRedactedSessionEnvelopeResult,
  AgentRuntimeSessionBoundaryRequest,
} from '../../../../lib/bridge';
import type { AgentRuntimeToolRow } from '../../../../lib/agent-runtime/types';

function readyToolRow(): AgentRuntimeToolRow {
  return {
    toolId: 'codex-cli',
    label: 'Codex CLI',
    status: 'ready',
    summary: 'Codex CLI is ready.',
    version: '1.2.3',
    configPath: null,
    notes: [],
    capabilities: {
      mcp: true,
      skills: true,
      sessions: true,
      cost: true,
      remote: false,
    },
    paths: [
      {
        label: 'Sessions',
        path: '/Users/example/.codex/sessions',
        kind: 'sessions-root',
        exists: true,
        required: false,
        childCount: 2,
      },
    ],
    warnings: [],
  };
}

function readyAction() {
  const preview = buildAgentRuntimeSessionImportPreview(readyToolRow());
  const dryRun = buildAgentRuntimeSessionImportDryRun(preview);
  const approval = buildAgentRuntimeSessionImportApproval(dryRun, {
    approved: true,
    approvedBy: 'pm',
  });

  return buildAgentRuntimeSessionEnvelopeParseAction({
    approval,
    parseConfirmed: true,
    targetPath: '/Users/example/.codex/sessions/session-a.json',
    maxBytes: 65_536,
  });
}

function blockedAction() {
  const preview = buildAgentRuntimeSessionImportPreview({
    ...readyToolRow(),
    paths: [],
  });
  const dryRun = buildAgentRuntimeSessionImportDryRun(preview);
  const approval = buildAgentRuntimeSessionImportApproval(dryRun, {
    approved: true,
  });

  return buildAgentRuntimeSessionEnvelopeParseAction({
    approval,
    parseConfirmed: true,
    targetPath: '/Users/example/.codex/sessions/session-a.json',
    maxBytes: 65_536,
  });
}

function displayableExecution(execution: AgentRuntimeSessionEnvelopeParseExecution) {
  return {
    toolId: execution.toolId,
    label: execution.label,
    status: execution.status,
    summary: execution.summary,
    blockedReasons: execution.blockedReasons,
  };
}

describe('Agent Runtime session envelope parse executor', () => {
  it('executes a ready parse action once and returns an aggregate redacted summary', async () => {
    const action = readyAction();
    const seenRequests: AgentRuntimeSessionBoundaryRequest[] = [];

    const execution = await executeAgentRuntimeSessionEnvelopeParseAction(action, async (request) => {
      seenRequests.push(request);
      return {
        status: 'ready',
        allowedRootPath: '/Users/example/.codex/sessions',
        byteLength: 1024,
        maxBytes: request.maxBytes,
        contentRedacted: true,
        targetNameRedacted: true,
        envelope: {
          messageCount: 4,
          userMessageCount: 1,
          assistantMessageCount: 2,
          toolMessageCount: 1,
          otherMessageCount: 0,
          toolCallCount: 2,
        },
        blockedReasons: [],
      };
    });

    expect(seenRequests).toEqual([action.parseRequest]);
    expect(execution.status).toBe('ready');
    expect(execution.parserResult?.envelope).toEqual({
      messageCount: 4,
      userMessageCount: 1,
      assistantMessageCount: 2,
      toolMessageCount: 1,
      otherMessageCount: 0,
      toolCallCount: 2,
    });
    expect(execution.summary).toBe(
      'Session envelope: 4 message(s) parsed (user 1, assistant 2, tool 1, other 0); 2 tool call(s). Content and target names redacted.',
    );
    expect(execution.blockedReasons).toEqual([]);
  });

  it('does not call the parser when approval is still required', async () => {
    const preview = buildAgentRuntimeSessionImportPreview(readyToolRow());
    const dryRun = buildAgentRuntimeSessionImportDryRun(preview);
    const approval = buildAgentRuntimeSessionImportApproval(dryRun, {
      approved: false,
    });
    const action = buildAgentRuntimeSessionEnvelopeParseAction({
      approval,
      parseConfirmed: true,
      targetPath: '/Users/example/.codex/sessions/session-a.json',
      maxBytes: 65_536,
    });
    let calls = 0;

    const execution = await executeAgentRuntimeSessionEnvelopeParseAction(action, async () => {
      calls += 1;
      throw new Error('parser should not run');
    });

    expect(calls).toBe(0);
    expect(execution.status).toBe('needs_approval');
    expect(execution.parserResult).toBeNull();
    expect(execution.summary).toBe(
      'Session envelope parse execution: needs approval. Review and explicitly approve the metadata-only dry run before reading transcripts.',
    );
  });

  it('does not call the parser when the action is blocked', async () => {
    const action = blockedAction();
    let calls = 0;

    const execution = await executeAgentRuntimeSessionEnvelopeParseAction(action, async () => {
      calls += 1;
      throw new Error('parser should not run');
    });

    expect(calls).toBe(0);
    expect(execution.status).toBe('blocked');
    expect(execution.parserResult).toBeNull();
    expect(execution.blockedReasons).toEqual(['No session root candidates are registered.']);
  });

  it('preserves a blocked parser result without leaking target content', async () => {
    const action = readyAction();
    const parserResult: AgentRuntimeRedactedSessionEnvelopeResult = {
      status: 'blocked',
      maxBytes: 65_536,
      contentRedacted: true,
      targetNameRedacted: true,
      envelope: null,
      blockedReasons: ['Target is outside approved session roots.'],
    };

    const execution = await executeAgentRuntimeSessionEnvelopeParseAction(action, async () => parserResult);

    expect(execution.status).toBe('blocked');
    expect(execution.parserResult).toBe(parserResult);
    expect(execution.summary).toBe('Session envelope: blocked. Target is outside approved session roots.');
    expect(execution.blockedReasons).toEqual(['Target is outside approved session roots.']);
  });

  it('converts parser errors to a redacted blocked execution', async () => {
    const action = readyAction();

    const execution = await executeAgentRuntimeSessionEnvelopeParseAction(action, async () => {
      throw new Error('session-a.json contained private transcript text and openai_api_key=bad');
    });

    expect(execution.status).toBe('blocked');
    expect(execution.parserResult).toBeNull();
    expect(execution.blockedReasons).toEqual(['Envelope parser failed; redacted error recorded.']);
    expect(JSON.stringify(displayableExecution(execution))).not.toContain('session-a.json');
    expect(JSON.stringify(displayableExecution(execution))).not.toContain('private transcript text');
    expect(JSON.stringify(displayableExecution(execution))).not.toContain('openai_api_key=bad');
  });

  it('keeps displayable execution output free of transcript names, tool args, and secrets', async () => {
    const action = readyAction();
    const execution = await executeAgentRuntimeSessionEnvelopeParseAction(action, async (request) => ({
      status: 'ready',
      allowedRootPath: request.rootPaths[0],
      byteLength: 2048,
      maxBytes: request.maxBytes,
      contentRedacted: true,
      targetNameRedacted: true,
      envelope: {
        messageCount: 3,
        userMessageCount: 1,
        assistantMessageCount: 1,
        toolMessageCount: 1,
        otherMessageCount: 0,
        toolCallCount: 1,
      },
      blockedReasons: [],
    }));

    const displayJson = JSON.stringify(displayableExecution(execution));
    expect(displayJson).not.toContain('session-a.json');
    expect(displayJson).not.toContain('cat secret.txt');
    expect(displayJson).not.toContain('openai_api_key=bad');
    expect(displayJson).not.toContain('private transcript text');
    expect(displayJson).toContain('Content and target names redacted');
  });
});
