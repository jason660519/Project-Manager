import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { IntegrationsDetailSheet } from '../../../../app/ui/views/Plugins/_shared/IntegrationsDetailSheet';
import {
  buildAgentRuntimeRedactedSessionTargetOptions,
} from '../../../../lib/integrations/mappers/agent-runtime-detail';
import { I18nProvider } from '../../../../lib/i18n';
import type {
  AgentRuntimeSessionEnvelopeParseAction,
  AgentRuntimeSessionEnvelopeParseExecution,
} from '../../../../lib/agent-runtime';
import type { IntegrationRow } from '../../../../lib/integrations/types';
import type { PluginCatalog } from '../../../../lib/types/plugins';

const emptyCatalog: PluginCatalog = { schemaVersion: 2, plugins: [] };

function agentRuntimeRow(agentRuntimeOverrides: Record<string, unknown> = {}): IntegrationRow {
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
        ...agentRuntimeOverrides,
      },
      diagnostics: [],
    },
  };
}

function rowWithTargets(): IntegrationRow {
  return agentRuntimeRow({
    sessionTargets: [
      {
        targetPath: '/Users/example/.codex/sessions/session-a.json',
        rootPath: '/Users/example/.codex/sessions',
        byteLength: 1024,
        modifiedAt: '2026-06-23T00:01:00.000Z',
        transcriptText: 'private transcript text',
        toolArguments: 'cat secret.txt',
      },
      {
        targetPath: '/tmp/session-b.json',
        rootPath: '/tmp',
        byteLength: 2048,
      },
      {
        targetPath: '',
        byteLength: 4096,
      },
    ],
  });
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
      'Session envelope: 2 message(s) parsed (user 1, assistant 1, tool 0, other 0); 0 tool call(s). Content and target names redacted.',
    parserResult: null,
    blockedReasons: [],
  };
}

describe('F76 Agent Runtime redacted session target selector', () => {
  it('builds redacted target options and filters invalid or outside-root candidates', () => {
    const options = buildAgentRuntimeRedactedSessionTargetOptions(rowWithTargets());

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({
      id: 'session-target-1',
      label: 'Session target 1',
      targetPath: '/Users/example/.codex/sessions/session-a.json',
      summary: 'Session target 1 · 1024 byte(s) · modified 2026-06-23T00:01:00.000Z',
    });
    expect(options[0].label).not.toContain('session-a.json');
    expect(options[0].summary).not.toContain('session-a.json');
    expect(options[0].summary).not.toContain('private transcript text');
    expect(options[0].summary).not.toContain('cat secret.txt');
  });

  it('renders a redacted selector and executes with the selected internal target path', async () => {
    const user = userEvent.setup();
    const onParseAgentRuntimeSessionEnvelope = vi.fn(async (action: AgentRuntimeSessionEnvelopeParseAction) => {
      expect(action.status).toBe('ready');
      expect(action.parseRequest?.targetPath).toBe('/Users/example/.codex/sessions/session-a.json');
      return readyExecution();
    });

    renderDetail(rowWithTargets(), { onParseAgentRuntimeSessionEnvelope });

    const panel = screen.getByRole('region', { name: 'Redacted session envelope parser' });
    expect(within(panel).queryByLabelText('Session target path')).not.toBeInTheDocument();
    const selector = within(panel).getByLabelText('Redacted session target');
    expect(within(panel).getByText('Session target 1 · 1024 byte(s) · modified 2026-06-23T00:01:00.000Z')).toBeInTheDocument();
    expect(panel.textContent ?? '').not.toContain('session-a.json');
    expect(panel.textContent ?? '').not.toContain('private transcript text');
    expect(panel.textContent ?? '').not.toContain('cat secret.txt');

    const parseButton = within(panel).getByRole('button', { name: 'Parse envelope metadata' });
    expect(parseButton).toBeDisabled();
    await user.selectOptions(selector, 'session-target-1');
    expect(parseButton).toBeDisabled();
    await user.click(within(panel).getByLabelText('Approve metadata-only envelope parse'));
    expect(parseButton).toBeEnabled();
    await user.click(parseButton);

    expect(onParseAgentRuntimeSessionEnvelope).toHaveBeenCalledTimes(1);
    expect(await within(panel).findByText(/2 message\(s\) parsed/)).toBeInTheDocument();
  });

  it('keeps the manual target path fallback when no redacted candidates exist', () => {
    renderDetail(agentRuntimeRow(), {
      onParseAgentRuntimeSessionEnvelope: vi.fn(),
    });

    const panel = screen.getByRole('region', { name: 'Redacted session envelope parser' });
    expect(within(panel).getByLabelText('Session target path')).toBeInTheDocument();
    expect(within(panel).queryByLabelText('Redacted session target')).not.toBeInTheDocument();
  });
});
