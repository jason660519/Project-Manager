import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  KeysProviderTable,
  type KeysRowData,
} from '../app/ui/views/Keys/KeysProviderTable';
import { PROVIDERS } from '../lib/keys/registry';
import type { ProviderSpec } from '../lib/keys/registry';
import { en } from '../lib/i18n/en';
import { zhHant } from '../lib/i18n/zh-hant';

function rowFixture(overrides: Partial<KeysRowData> = {}, providerPatch: Partial<ProviderSpec> = {}): KeysRowData {
  const provider = {
    ...(PROVIDERS.find((item) => item.id === 'openai') ?? PROVIDERS[0]),
    ...providerPatch,
  };
  return {
    provider,
    hasKey: false,
    maskedKey: null,
    status: 'not_set',
    models: ['gpt-4o'],
    modelsAreDynamic: false,
    modelListState: {
      kind: 'catalogue',
      label: 'Catalogue',
      detail: 'Using curated model catalogue',
    },
    canRefreshModels: false,
    lastValidatedAt: null,
    errorReason: null,
    ...overrides,
  };
}

function renderTable(props: Partial<React.ComponentProps<typeof KeysProviderTable>> = {}) {
  return render(
    <KeysProviderTable
      rows={[rowFixture()]}
      onRowClick={vi.fn()}
      onAddRow={vi.fn()}
      onRestoreDefaultProviders={vi.fn()}
      onPatchCustomProvider={vi.fn()}
      onRefreshModels={vi.fn()}
      refreshingProviderIds={new Set()}
      onShowAllRows={vi.fn()}
      copy={en.keysValidation.table}
      {...props}
    />,
  );
}

describe('KeysProviderTable', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders provider links as compact icons inside the provider cell', () => {
    const row = rowFixture();
    renderTable({ rows: [row] });

    expect(screen.getAllByText('Provider').length).toBeGreaterThan(0);
    expect(screen.queryByRole('columnheader', { name: 'API Key' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Usage' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Docs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Models' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Model list' })).not.toBeInTheDocument();

    expect(screen.getByLabelText('Model list: Catalogue')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Official API key page' })).toHaveAttribute(
      'href',
      row.provider.apiKeyUrl,
    );
    expect(screen.getByRole('link', { name: 'Usage / balance' })).toHaveAttribute(
      'href',
      row.provider.usageUrl,
    );
    expect(screen.getByRole('link', { name: 'Developer docs' })).toHaveAttribute(
      'href',
      row.provider.developerDocsUrl,
    );
    expect(screen.getByLabelText('Models: 1')).toHaveTextContent('1');
  });

  it('renders localized link labels when a different locale copy is provided', () => {
    renderTable({ copy: zhHant.keysValidation.table });

    expect(screen.getByRole('link', { name: '官方API金鑰申請' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '用量餘額查詢' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '官方開發文件' })).toBeInTheDocument();
  });

  it('opens provider links in a new tab without triggering row selection', () => {
    const onRowClick = vi.fn();
    renderTable({ rows: [rowFixture()], onRowClick });

    const apiKeyLink = screen.getByRole('link', { name: 'Official API key page' });
    expect(apiKeyLink).toHaveAttribute('target', '_blank');
    expect(apiKeyLink).toHaveAttribute('rel', 'noreferrer');

    fireEvent.click(apiKeyLink);

    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('renders the compact provider toolbar and header filters', () => {
    renderTable({ hiddenBuiltInCount: 2 });

    expect(screen.getByPlaceholderText('Search provider, key state, models')).toBeInTheDocument();
    expect(screen.getByLabelText('Freeze cols')).toHaveValue(1);
    expect(screen.getByRole('button', { name: /Restore default providers/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add provider/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show hidden rows \(2\)/i })).toBeInTheDocument();

    expect(screen.getByLabelText('Provider filter')).toHaveValue('all');
    expect(screen.getByLabelText('Category filter')).toHaveValue('all');
    expect(screen.getByLabelText('Status filter')).toHaveValue('all');
    expect(screen.getByLabelText('Available models filter')).toHaveValue('all');
    expect(screen.getByRole('option', { name: 'Model makers' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Model channels' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Local models' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Integration' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Export/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Import/i })).not.toBeInTheDocument();
  });

  it('freezes the first N visible columns from the numeric freeze control', () => {
    renderTable();

    const freezeInput = screen.getByLabelText('Freeze cols');
    fireEvent.change(freezeInput, { target: { value: '2' } });

    expect(freezeInput).toHaveValue(2);
  });

  it('filters providers by the product-facing provider category', () => {
    renderTable({
      rows: [
        rowFixture({}, { id: 'openai', label: 'OpenAI', category: 'ai' }),
        rowFixture({}, { id: 'openrouter', label: 'OpenRouter', category: 'ai' }),
        rowFixture({}, { id: 'ollama-local', label: 'Ollama (Local)', category: 'ai' }),
        rowFixture({}, { id: 'github', label: 'GitHub Personal Access Token', category: 'integration' }),
      ],
    });

    fireEvent.change(screen.getByLabelText('Category filter'), {
      target: { value: 'model_channel' },
    });

    const renderedRows = Array.from(document.querySelectorAll('tbody tr'));
    expect(renderedRows.some((row) => row.textContent?.includes('OpenRouter'))).toBe(true);
    expect(renderedRows.some((row) => row.textContent?.includes('OpenAI'))).toBe(false);
    expect(renderedRows.some((row) => row.textContent?.includes('Ollama (Local)'))).toBe(false);
    expect(renderedRows.some((row) => row.textContent?.includes('GitHub Personal Access Token'))).toBe(false);
  });

  it('filters providers by selected available model from the column header', () => {
    renderTable({
      rows: [
        rowFixture({ models: ['gpt-4o'] }, { id: 'openai', label: 'OpenAI' }),
        rowFixture({ models: ['claude-sonnet-4-5'] }, { id: 'anthropic', label: 'Anthropic' }),
      ],
    });

    fireEvent.change(screen.getByLabelText('Available models filter'), {
      target: { value: 'claude-sonnet-4-5' },
    });

    const renderedRows = Array.from(document.querySelectorAll('tbody tr'));
    expect(renderedRows.some((row) => row.textContent?.includes('Anthropic'))).toBe(true);
    expect(renderedRows.some((row) => row.textContent?.includes('OpenAI'))).toBe(false);
  });

  it('fires the add-row callback from the toolbar', () => {
    const onAddRow = vi.fn();
    renderTable({ onAddRow });

    fireEvent.click(screen.getByRole('button', { name: /Add provider/i }));

    expect(onAddRow).toHaveBeenCalledTimes(1);
  });

  it('refreshes one provider model list without triggering row selection', () => {
    const onRefreshModels = vi.fn();
    const onRowClick = vi.fn();
    const row = rowFixture({ hasKey: true, status: 'verified', canRefreshModels: true });
    renderTable({ rows: [row], onRefreshModels, onRowClick });

    fireEvent.click(screen.getByLabelText('Re-verify OpenAI and refresh available models'));

    expect(onRefreshModels).toHaveBeenCalledWith(row.provider);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('disables only the provider currently refreshing from the status column', () => {
    renderTable({
      rows: [
        rowFixture({ hasKey: true, status: 'verified', canRefreshModels: true }, { id: 'openai', label: 'OpenAI' }),
        rowFixture({ hasKey: true, status: 'verified', canRefreshModels: true }, { id: 'anthropic', label: 'Anthropic' }),
      ],
      refreshingProviderIds: new Set(['openai']),
    });

    expect(screen.getByLabelText('Re-verify OpenAI and refresh available models')).toBeDisabled();
    expect(screen.getByLabelText('Re-verify Anthropic and refresh available models')).not.toBeDisabled();
  });

  it('renders editable fields for custom provider rows', () => {
    const onPatchCustomProvider = vi.fn();
    const row = rowFixture(
      { isCustom: true },
      {
        id: 'custom-provider-1',
        label: 'Custom Provider 1',
        apiKeyUrl: 'https://keys.example.com',
        usageUrl: 'https://usage.example.com',
        developerDocsUrl: 'https://docs.example.com',
      },
    );
    renderTable({ rows: [row], onPatchCustomProvider });

    // EditableTextCell holds a local draft and commits on blur (not per keystroke)
    // so the table does not re-render mid-typing and the input keeps focus.
    const labelInput = screen.getByDisplayValue('Custom Provider 1');
    fireEvent.change(labelInput, { target: { value: 'Updated Provider' } });
    fireEvent.blur(labelInput);

    expect(onPatchCustomProvider).toHaveBeenCalledWith(row.provider.id, { label: 'Updated Provider' });
    expect(screen.getByRole('link', { name: 'Official API key page' })).toHaveAttribute(
      'href',
      'https://keys.example.com',
    );
    expect(screen.getByRole('link', { name: 'Usage / balance' })).toHaveAttribute(
      'href',
      'https://usage.example.com',
    );
    expect(screen.getByRole('link', { name: 'Developer docs' })).toHaveAttribute(
      'href',
      'https://docs.example.com',
    );
  });
});
