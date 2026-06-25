import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { IntegrationsDetailSheet } from '../../../../app/ui/views/Plugins/_shared/IntegrationsDetailSheet';
import {
  buildAgentRuntimeSessionEnvelopeUiParseAction,
} from '../../../../lib/integrations/mappers/agent-runtime-detail';
import { I18nProvider } from '../../../../lib/i18n';
import type {
  AgentRuntimeSessionEnvelopeParseAction,
  AgentRuntimeSessionEnvelopeParseExecution,
} from '../../../../lib/agent-runtime';
import type { IntegrationRow } from '../../../../lib/integrations/types';
import type { PluginCatalog } from '../../../../lib/types/plugins';

const emptyCatalog: PluginCatalog = { schemaVersion: 2, plugins: [] };

function agentRuntimeRow(overrides: Partial<IntegrationRow> = {}): IntegrationRow {
  return {
    rowKey: 'agent-runtime:codex-cli',
    sheet: 'agent-runtime',
    sourceKind: 'agent-runtime',
    sourceId: 'codex-cli',
    enabled: true,
    category1: 'Agent Runtime',
    category2: 'CLI',
    githubUrl: '',
    company: 'OpenAI',
    name: 'Codex CLI',
    version: '1.2.3',
    license: '',
    scope: 'user',
    port: '',
    installPath: '/usr/local/bin/codex',
    installMethod: 'PATH',
    status: 'connected',
    statusLabel: 'Ready',
    lastUpdated: '2026-06-23T00:00:00.000Z',
    notes: '',
    lv: null,
    badges: ['agent-runtime'],
    payload: {
      loadedAt: '2026-06-23T00:00:00.000Z',
      agentRuntime: {
        rowId: 'agent-runtime:codex-cli',
        toolId: 'codex-cli',
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
            label: 'Sessions',
            path: '/Users/example/.codex/sessions',
            kind: 'sessions-root',
            exists: true,
            required: false,
            secretBearing: false,
            childCount: 2,
          },
        ],
        warnings: [],
      },
      diagnostics: [],
    },
    ...overrides,
  };
}

function renderDetail(
  row: IntegrationRow,
  props: Partial<React.ComponentProps<typeof IntegrationsDetailSheet>> = {},
) {
  return render(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(IntegrationsDetailSheet, {
        row,
        onClose: vi.fn(),
        catalog: emptyCatalog,
        apiKeys: {},
        providers: [],
        onCatalogChange: vi.fn(),
        onApiKeyChange: vi.fn(),
        ...props,
      }),
    ),
  );
}

function readyExecution(): AgentRuntimeSessionEnvelopeParseExecution {
  return {
    toolId: 'codex-cli',
    label: 'Codex CLI',
    status: 'ready',
    summary:
      'Session envelope: 4 message(s) parsed (user 1, assistant 2, tool 1, other 0); 2 tool call(s). Content and target names redacted.',
    parserResult: {
      status: 'ready',
      allowedRootPath: '/Users/example/.codex/sessions',
      byteLength: 1024,
      maxBytes: 65_536,
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
    },
    blockedReasons: [],
  };
}

describe('F75 Agent Runtime session envelope UI execute flow', () => {
  it('builds a ready UI parse action only after approval and target selection', () => {
    const action = buildAgentRuntimeSessionEnvelopeUiParseAction(agentRuntimeRow(), {
      approved: true,
      targetPath: '/Users/example/.codex/sessions/session-a.json',
      maxBytes: 65_536,
      approvedBy: 'pm-ui',
    });

    expect(action?.status).toBe('ready');
    expect(action?.parseRequest).toEqual({
      approved: true,
      rootPaths: ['/Users/example/.codex/sessions'],
      targetPath: '/Users/example/.codex/sessions/session-a.json',
      maxBytes: 65_536,
    });
    expect(action?.summary).toBe(
      'Session envelope parse action: ready for one selected target across 1 approved root(s); max 65536 byte(s). Target name redacted.',
    );
  });

  it('keeps the parse button disabled until approval and target path are present, then calls the injected executor once', async () => {
    const user = userEvent.setup();
    const onParseAgentRuntimeSessionEnvelope = vi.fn(async (action: AgentRuntimeSessionEnvelopeParseAction) => {
      expect(action.status).toBe('ready');
      expect(action.parseRequest?.targetPath).toBe('/Users/example/.codex/sessions/session-a.json');
      return readyExecution();
    });

    renderDetail(agentRuntimeRow(), { onParseAgentRuntimeSessionEnvelope });

    const panel = screen.getByRole('region', { name: 'Redacted session envelope parser' });
    const parseButton = within(panel).getByRole('button', { name: 'Parse envelope metadata' });
    expect(parseButton).toBeDisabled();
    expect(within(panel).getByText(/Review and explicitly approve/)).toBeInTheDocument();

    await user.type(
      within(panel).getByLabelText('Session target path'),
      '/Users/example/.codex/sessions/session-a.json',
    );
    expect(parseButton).toBeDisabled();

    await user.click(within(panel).getByLabelText('Approve metadata-only envelope parse'));
    expect(parseButton).toBeEnabled();

    await user.click(parseButton);

    expect(onParseAgentRuntimeSessionEnvelope).toHaveBeenCalledTimes(1);
    expect(await within(panel).findByText(/4 message\(s\) parsed/)).toBeInTheDocument();
    expect(within(panel).getByText(/Content and target names redacted/)).toBeInTheDocument();
  });

  it('redacts thrown executor errors before showing the result state', async () => {
    const user = userEvent.setup();
    const onParseAgentRuntimeSessionEnvelope = vi.fn(async () => {
      throw new Error('session-a.json contained private transcript text and openai_api_key=bad');
    });

    renderDetail(agentRuntimeRow(), { onParseAgentRuntimeSessionEnvelope });

    const panel = screen.getByRole('region', { name: 'Redacted session envelope parser' });
    await user.type(
      within(panel).getByLabelText('Session target path'),
      '/Users/example/.codex/sessions/session-a.json',
    );
    await user.click(within(panel).getByLabelText('Approve metadata-only envelope parse'));
    await user.click(within(panel).getByRole('button', { name: 'Parse envelope metadata' }));

    const result = await within(panel).findByText(
      'Session envelope parse execution: blocked. Envelope parser failed; redacted error recorded.',
    );
    expect(result).toBeInTheDocument();
    const resultText = result.textContent ?? '';
    expect(resultText).not.toContain('session-a.json');
    expect(resultText).not.toContain('private transcript text');
    expect(resultText).not.toContain('openai_api_key=bad');
  });

  it('shows blocked parser summaries without exposing transcript details', async () => {
    const user = userEvent.setup();
    const onParseAgentRuntimeSessionEnvelope = vi.fn(async (): Promise<AgentRuntimeSessionEnvelopeParseExecution> => ({
      toolId: 'codex-cli',
      label: 'Codex CLI',
      status: 'blocked',
      summary: 'Session envelope: blocked. Target is outside approved session roots.',
      parserResult: {
        status: 'blocked',
        maxBytes: 65_536,
        contentRedacted: true,
        targetNameRedacted: true,
        envelope: null,
        blockedReasons: ['Target is outside approved session roots.'],
      },
      blockedReasons: ['Target is outside approved session roots.'],
    }));

    renderDetail(agentRuntimeRow(), { onParseAgentRuntimeSessionEnvelope });

    const panel = screen.getByRole('region', { name: 'Redacted session envelope parser' });
    await user.type(
      within(panel).getByLabelText('Session target path'),
      '/Users/example/.codex/sessions/session-a.json',
    );
    await user.click(within(panel).getByLabelText('Approve metadata-only envelope parse'));
    await user.click(within(panel).getByRole('button', { name: 'Parse envelope metadata' }));

    expect(await within(panel).findByText('Session envelope: blocked. Target is outside approved session roots.')).toBeInTheDocument();
    expect(panel.textContent ?? '').not.toContain('private transcript text');
    expect(panel.textContent ?? '').not.toContain('openai_api_key=bad');
    expect(panel.textContent ?? '').not.toContain('cat secret.txt');
  });
});
