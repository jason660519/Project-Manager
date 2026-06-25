import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IntegrationsDetailSheet } from '../../../../app/ui/views/Plugins/_shared/IntegrationsDetailSheet';
import { I18nProvider } from '../../../../lib/i18n';
import type { IntegrationRow } from '../../../../lib/integrations/types';
import type { PluginCatalog } from '../../../../lib/types/plugins';

const emptyCatalog: PluginCatalog = { schemaVersion: 2, plugins: [] };

function agentRuntimeRow(diagnostics: unknown[] = []): IntegrationRow {
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
      diagnostics,
    },
  };
}

function renderDetail(row: IntegrationRow) {
  return render(
    <I18nProvider>
      <IntegrationsDetailSheet
        row={row}
        onClose={vi.fn()}
        catalog={emptyCatalog}
        apiKeys={{}}
        providers={[]}
        onCatalogChange={vi.fn()}
        onApiKeyChange={vi.fn()}
      />
    </I18nProvider>,
  );
}

describe('F79 Agent Runtime session target diagnostics UI', () => {
  it('surfaces safe session target hydration diagnostics in a dedicated detail region', () => {
    renderDetail(
      agentRuntimeRow([
        {
          code: 'session_target_list_failed',
          severity: 'warning',
          message: 'Session target listing blocked for Codex CLI: Explicit approval is required.',
        },
      ]),
    );

    const region = screen.getByRole('region', { name: 'Session target diagnostics' });
    expect(within(region).getByText('Session target diagnostics')).toBeInTheDocument();
    expect(within(region).getByText('session_target_list_failed')).toBeInTheDocument();
    expect(
      within(region).getByText('Session target listing blocked for Codex CLI: Explicit approval is required.'),
    ).toBeInTheDocument();
    expect(within(region).getByText(/Manual session target path fallback remains available/i)).toBeInTheDocument();
  });

  it('does not render the dedicated session target diagnostics region when there are no hydration diagnostics', () => {
    renderDetail(agentRuntimeRow());

    expect(screen.queryByRole('region', { name: 'Session target diagnostics' })).not.toBeInTheDocument();
  });

  it('keeps unsafe thrown lister details out of visible diagnostic UI', () => {
    renderDetail(
      agentRuntimeRow([
        {
          code: 'session_target_list_failed',
          severity: 'warning',
          message: 'Session target listing failed for Codex CLI; error details redacted.',
        },
      ]),
    );

    const region = screen.getByRole('region', { name: 'Session target diagnostics' });
    expect(region.textContent ?? '').not.toContain('secret-session-a.jsonl');
    expect(region.textContent ?? '').not.toContain('sk-unsafe');
    expect(region.textContent ?? '').not.toContain('private transcript text');
  });
});
