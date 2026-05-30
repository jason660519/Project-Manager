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
      onMoveRow={vi.fn()}
      onDeleteRow={vi.fn()}
      onPatchCustomProvider={vi.fn()}
      onRefreshModels={vi.fn()}
      isRefreshingModels={false}
      onImportRows={vi.fn()}
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

  it('renders official provider links immediately after the provider column', () => {
    const row = rowFixture();
    renderTable({ rows: [row] });

    expect(screen.getAllByText('Provider').length).toBeGreaterThan(0);
    expect(screen.getAllByText('API Key').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Usage').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Docs').length).toBeGreaterThan(0);

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

  it('renders sheet-standard controls for search, filters, presets, import, export, and row creation', () => {
    renderTable({ hiddenBuiltInCount: 2 });

    expect(screen.getByPlaceholderText('Search provider, key state, models')).toBeInTheDocument();
    expect(screen.getByDisplayValue('All categories')).toBeInTheDocument();
    expect(screen.getByDisplayValue('All status')).toBeInTheDocument();
    expect(screen.getByText('Hidden (0)')).toBeInTheDocument();
    expect(screen.getByText('Freeze cols')).toBeInTheDocument();
    expect(screen.getByLabelText('View preset')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Row/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show hidden rows \(2\)/i })).toBeInTheDocument();
  });

  it('fires the add-row callback from the toolbar', () => {
    const onAddRow = vi.fn();
    renderTable({ onAddRow });

    fireEvent.click(screen.getByRole('button', { name: /Add Row/i }));

    expect(onAddRow).toHaveBeenCalledTimes(1);
  });

  it('moves and deletes rows without triggering row selection', () => {
    const onMoveRow = vi.fn();
    const onDeleteRow = vi.fn();
    const onRowClick = vi.fn();
    const row = rowFixture();
    renderTable({ rows: [row], onMoveRow, onDeleteRow, onRowClick });

    fireEvent.click(screen.getByTitle('Move row up'));
    fireEvent.click(screen.getByTitle('Move row down'));
    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));

    expect(onMoveRow).toHaveBeenNthCalledWith(1, row.provider.id, 'up');
    expect(onMoveRow).toHaveBeenNthCalledWith(2, row.provider.id, 'down');
    expect(onDeleteRow).toHaveBeenCalledWith(row.provider.id);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('refreshes one provider model list without triggering row selection', () => {
    const onRefreshModels = vi.fn();
    const onRowClick = vi.fn();
    const row = rowFixture({ hasKey: true, status: 'verified', canRefreshModels: true });
    renderTable({ rows: [row], onRefreshModels, onRowClick });

    fireEvent.click(screen.getByTitle('Refresh Models list'));

    expect(onRefreshModels).toHaveBeenCalledWith(row.provider);
    expect(onRowClick).not.toHaveBeenCalled();
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

    fireEvent.change(screen.getByDisplayValue('Custom Provider 1'), {
      target: { value: 'Updated Provider' },
    });
    fireEvent.change(screen.getByDisplayValue('https://keys.example.com'), {
      target: { value: 'https://keys.example.com/new' },
    });

    expect(onPatchCustomProvider).toHaveBeenCalledWith(row.provider.id, { label: 'Updated Provider' });
    expect(onPatchCustomProvider).toHaveBeenCalledWith(row.provider.id, {
      apiKeyUrl: 'https://keys.example.com/new',
      docUrl: 'https://keys.example.com/new',
    });
  });
});
