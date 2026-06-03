import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  KeysProviderTable,
  type KeysRowData,
} from '../app/ui/views/Keys/KeysProviderTable';
import { PROVIDERS } from '../lib/keys/registry';
import type { ProviderSpec } from '../lib/keys/registry';
import { en } from '../lib/i18n/en';
import { zhHant } from '../lib/i18n/zh-hant';

const API_KEYS_STORAGE_KEY = 'projectManager.keys.apiKeyValidation.tablePrefs.v1';

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
    rowId: overrides.rowId ?? `00000000-0000-5000-8000-${provider.id.padEnd(12, '0').slice(0, 12)}`,
    active: overrides.active ?? true,
  };
}

function renderTable(props: Partial<React.ComponentProps<typeof KeysProviderTable>> = {}) {
  return render(
    <KeysProviderTable
      rows={props.rows ?? [rowFixture()]}
      onRowClick={props.onRowClick ?? vi.fn()}
      onAddRow={props.onAddRow ?? vi.fn()}
      onRestoreDefaultProviders={props.onRestoreDefaultProviders ?? vi.fn()}
      onPatchCustomProvider={props.onPatchCustomProvider ?? vi.fn()}
      onUpdateProviderActive={props.onUpdateProviderActive ?? vi.fn().mockResolvedValue(undefined)}
      onDeleteProvider={props.onDeleteProvider ?? vi.fn().mockResolvedValue(undefined)}
      onUpdateKey={props.onUpdateKey ?? vi.fn()}
      onRefreshModels={props.onRefreshModels ?? vi.fn()}
      refreshingProviderIds={props.refreshingProviderIds ?? new Set()}
      onShowAllRows={props.onShowAllRows ?? vi.fn()}
      copy={props.copy ?? en.keysValidation.table}
      hiddenBuiltInCount={props.hiddenBuiltInCount}
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
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();

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

  it('renders key var name before key value without changing masked key display', () => {
    renderTable({
      rows: [
        rowFixture({
          hasKey: true,
          maskedKey: 'sk-••••vDYA',
        }),
      ],
    });

    const headers = Array.from(document.querySelectorAll('thead th'))
      .map((header) => header.textContent ?? '');
    const keyVarNameIndex = headers.findIndex((text) => text.includes('Key Var Name'));
    const keyValueIndex = headers.findIndex((text) => text.includes('Key Value'));

    expect(keyVarNameIndex).toBeGreaterThan(-1);
    expect(keyValueIndex).toBeGreaterThan(-1);
    expect(keyVarNameIndex).toBeLessThan(keyValueIndex);
    expect(screen.getByText('OPENAI_API_KEY')).toBeInTheDocument();
    expect(screen.getByLabelText('OpenAI Key Value')).toHaveAttribute('placeholder', 'sk-••••vDYA');
    expect(screen.getByRole('button', { name: 'Update API key' })).toBeInTheDocument();
  });

  it('updates a key value from the cell editor and clears the draft on success', async () => {
    const onUpdateKey = vi.fn().mockResolvedValue(undefined);
    renderTable({ onUpdateKey });

    fireEvent.change(screen.getByLabelText('OpenAI Key Value'), {
      target: { value: `sk-${'a'.repeat(40)}` },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update API key' }));

    await waitFor(() => expect(onUpdateKey).toHaveBeenCalledTimes(1));
    expect(onUpdateKey).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'openai' }),
      `sk-${'a'.repeat(40)}`,
    );
    expect(screen.getByLabelText('OpenAI Key Value')).toHaveValue('');
    expect(screen.getByText('Key updated')).toBeInTheDocument();
  });

  it('keeps key values hidden by default and lets the user temporarily reveal them', () => {
    renderTable();

    const input = screen.getByLabelText('OpenAI Key Value');
    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show API key' }));

    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide API key' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide API key' }));

    expect(input).toHaveAttribute('type', 'password');
  });

  it('validates key format before sending the update request', () => {
    const onUpdateKey = vi.fn();
    renderTable({ onUpdateKey });

    fireEvent.change(screen.getByLabelText('OpenAI Key Value'), {
      target: { value: 'not-an-openai-key' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update API key' }));

    expect(onUpdateKey).not.toHaveBeenCalled();
    expect(screen.getByText("API key does not match this provider's expected format")).toBeInTheDocument();
  });

  it('disables editing while saving and preserves the draft on update failure', async () => {
    let rejectUpdate: (error: Error) => void = () => undefined;
    const onUpdateKey = vi.fn(() => new Promise<void>((_resolve, reject) => {
      rejectUpdate = reject;
    }));
    renderTable({ onUpdateKey });

    const value = `sk-${'b'.repeat(40)}`;
    fireEvent.change(screen.getByLabelText('OpenAI Key Value'), {
      target: { value },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update API key' }));

    await waitFor(() => expect(screen.getByLabelText('OpenAI Key Value')).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Update API key' })).toBeDisabled();

    rejectUpdate(new Error('Provider 401'));

    await waitFor(() => expect(screen.getByText('Provider 401')).toBeInTheDocument());
    expect(screen.getByLabelText('OpenAI Key Value')).not.toBeDisabled();
    expect(screen.getByLabelText('OpenAI Key Value')).toHaveValue(value);
  });

  it('freezes the first N visible columns from the numeric freeze control', () => {
    renderTable();

    const freezeInput = screen.getByLabelText('Freeze cols');
    fireEvent.change(freezeInput, { target: { value: '2' } });

    expect(freezeInput).toHaveValue(2);
  });

  it('lets Freeze through this column reset the boundary on an already frozen column', () => {
    renderTable();

    const freezeInput = screen.getByLabelText('Freeze cols');
    fireEvent.change(freezeInput, { target: { value: '3' } });
    expect(freezeInput).toHaveValue(3);

    fireEvent.contextMenu(screen.getByRole('columnheader', { name: /Active/i }), { clientX: 80, clientY: 90 });
    fireEvent.click(screen.getByRole('menuitem', { name: /Freeze through this column/i }));

    expect(freezeInput).toHaveValue(2);
  });

  it('resizes the right-clicked column from the column context menu', async () => {
    renderTable();

    const providerHeader = screen.getByRole('columnheader', { name: /Provider/i });
    fireEvent.contextMenu(providerHeader, { clientX: 80, clientY: 90 });
    fireEvent.click(screen.getByRole('menuitem', { name: /Resize this column/i }));
    fireEvent.change(within(screen.getByRole('dialog', { name: /Resize this column/i })).getByRole('textbox'), { target: { value: '222' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(API_KEYS_STORAGE_KEY) ?? '{}');
      expect(saved.columnSizing['col-provider']).toBe(222);
    });
  });

  it('clips cell content inside resized column boxes instead of overflowing into neighboring columns', () => {
    renderTable();

    expect(document.querySelector('table')).toHaveClass('table-fixed');
    for (const header of Array.from(document.querySelectorAll('thead th'))) {
      expect(header).toHaveClass('overflow-hidden');
    }
    for (const cell of Array.from(document.querySelectorAll('tbody td'))) {
      expect(cell).toHaveClass('overflow-hidden');
    }
  });

  it('keeps sticky headers layered above body cells while scrolling', () => {
    renderTable();

    expect(document.querySelector('thead')).toHaveClass('z-40');
    expect(document.querySelector('thead th')).toHaveClass('z-50');
    const firstFrozenBodyCell = document.querySelector('tbody td');
    expect(firstFrozenBodyCell).toHaveClass('z-20');
    expect(screen.getByLabelText('OpenAI Key Value').closest('td')).not.toHaveClass('z-10');
  });

  it('shows an in-app error for invalid column width input', async () => {
    renderTable();

    fireEvent.contextMenu(screen.getByRole('columnheader', { name: /Provider/i }), { clientX: 80, clientY: 90 });
    fireEvent.click(screen.getByRole('menuitem', { name: /Resize this column/i }));
    fireEvent.change(within(screen.getByRole('dialog', { name: /Resize this column/i })).getByRole('textbox'), { target: { value: 'not-a-number' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(await screen.findByRole('alertdialog', { name: /Enter a number between 56 and 720 pixels/i })).toBeInTheDocument();
  });

  it('resizes all rows from the row context menu and persists row heights', async () => {
    renderTable({
      rows: [
        rowFixture({}, { id: 'openai', label: 'OpenAI' }),
        rowFixture({}, { id: 'anthropic', label: 'Anthropic' }),
      ],
    });

    const openAiRow = Array.from(document.querySelectorAll('tbody tr'))
      .find((row) => row.textContent?.includes('OpenAI'));
    expect(openAiRow).not.toBeNull();
    fireEvent.contextMenu(openAiRow as HTMLElement, { clientX: 90, clientY: 120 });
    fireEvent.click(screen.getByRole('menuitem', { name: /Resize all rows/i }));
    fireEvent.change(within(screen.getByRole('dialog', { name: /Resize all rows/i })).getByRole('textbox'), { target: { value: '88' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(API_KEYS_STORAGE_KEY) ?? '{}');
      expect(Object.values(saved.rowHeightById)).toEqual([88, 88]);
    });
  });

  it('keeps the row context menu inside the viewport near the bottom edge', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 240 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    renderTable({
      rows: [
        rowFixture({}, { id: 'openai', label: 'OpenAI' }),
        rowFixture({}, { id: 'github', label: 'GitHub Personal Access Token' }),
      ],
    });

    const githubRow = Array.from(document.querySelectorAll('tbody tr'))
      .find((row) => row.textContent?.includes('GitHub Personal Access Token'));
    expect(githubRow).not.toBeNull();

    fireEvent.contextMenu(githubRow as HTMLElement, { clientX: 260, clientY: 226 });

    const menu = screen.getByRole('menu', { name: 'Row options' });
    expect(Number.parseFloat(menu.style.top)).toBeLessThan(226);
    expect(Number.parseFloat(menu.style.left)).toBeLessThan(260);
    expect(Number.parseFloat(menu.style.top)).toBeGreaterThanOrEqual(8);
    expect(Number.parseFloat(menu.style.left)).toBeGreaterThanOrEqual(8);
  });

  it('highlights the row or column targeted by the open context menu', () => {
    renderTable({
      rows: [
        rowFixture({}, { id: 'openai', label: 'OpenAI' }),
        rowFixture({}, { id: 'github', label: 'GitHub Personal Access Token' }),
      ],
    });

    const githubRow = Array.from(document.querySelectorAll('tbody tr'))
      .find((row) => row.textContent?.includes('GitHub Personal Access Token'));
    expect(githubRow).not.toBeNull();

    fireEvent.contextMenu(githubRow as HTMLElement, { clientX: 90, clientY: 120 });

    expect(githubRow).toHaveAttribute('data-context-target', 'row');
    expect(githubRow?.querySelectorAll('[data-context-target="row"]').length).toBeGreaterThan(0);

    fireEvent.click(document.body);
    fireEvent.contextMenu(screen.getByRole('columnheader', { name: /Provider/i }), { clientX: 80, clientY: 90 });

    expect(screen.getByRole('columnheader', { name: /Provider/i })).toHaveAttribute(
      'data-context-target',
      'column',
    );
    expect(document.querySelectorAll('tbody td[data-context-target="column"]').length).toBeGreaterThan(0);
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

  it('toggles provider active state without triggering row selection', async () => {
    const onUpdateProviderActive = vi.fn().mockResolvedValue(undefined);
    const onRowClick = vi.fn();
    const row = rowFixture({}, { id: 'openai', label: 'OpenAI' });
    renderTable({ rows: [row], onUpdateProviderActive, onRowClick });

    fireEvent.click(screen.getByLabelText('Active: OpenAI'));

    await waitFor(() => expect(onUpdateProviderActive).toHaveBeenCalledWith(row.provider, false));
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('filters inactive providers from the active column header filter', () => {
    renderTable({
      rows: [
        rowFixture({ active: true }, { id: 'openai', label: 'OpenAI' }),
        rowFixture({ active: false }, { id: 'anthropic', label: 'Anthropic' }),
      ],
    });

    fireEvent.change(screen.getByLabelText('Active filter'), {
      target: { value: 'inactive' },
    });

    const renderedRows = Array.from(document.querySelectorAll('tbody tr'));
    expect(renderedRows.some((row) => row.textContent?.includes('Anthropic'))).toBe(true);
    expect(renderedRows.some((row) => row.textContent?.includes('OpenAI'))).toBe(false);
  });

  it('uses the row context menu and an in-app confirmation dialog before deleting a provider row', async () => {
    const onDeleteProvider = vi.fn().mockResolvedValue(undefined);
    const onRowClick = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => {
      throw new Error('window.confirm should not be used in Project Manager UI');
    });
    const row = rowFixture({ isCustom: true }, { id: 'custom-provider-1', label: 'Custom Provider 1' });
    renderTable({ rows: [row], onDeleteProvider, onRowClick });

    const customRow = screen.getByDisplayValue('Custom Provider 1').closest('tr');
    expect(customRow).not.toBeNull();
    fireEvent.contextMenu(customRow as HTMLElement, { clientX: 90, clientY: 120 });
    fireEvent.click(screen.getByRole('menuitem', { name: /^Delete$/i }));

    expect(screen.getByRole('dialog', { name: 'Delete custom row' })).toBeInTheDocument();
    expect(onDeleteProvider).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));

    await waitFor(() => expect(onDeleteProvider).toHaveBeenCalledWith(row.provider));
    expect(onRowClick).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
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
    const keyVarInput = screen.getByDisplayValue('OPENAI_API_KEY');
    fireEvent.change(keyVarInput, { target: { value: 'BUSINESS_API_TOKEN' } });
    fireEvent.blur(keyVarInput);

    expect(onPatchCustomProvider).toHaveBeenCalledWith(row.provider.id, { envVarNames: ['BUSINESS_API_TOKEN'] });
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
