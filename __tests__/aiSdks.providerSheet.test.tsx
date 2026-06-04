import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AiSdkProviderSheet } from '../app/ui/views/AiSdks/AiSdkProviderSheet';
import { emptyAiSdksConfig } from '../lib/aiSdks/store';
import { en } from '../lib/i18n/en';

function renderSheet(overrides: Record<string, unknown> = {}) {
  return render(
    <AiSdkProviderSheet
      providerId="anthropic"
      store={emptyAiSdksConfig()}
      categories={['LLM', 'VLM']}
      readOnly={false}
      copy={en.aiSdks}
      dynamicModels={[]}
      modelListStatus={{ kind: 'catalogue', label: 'Catalogue', detail: 'Using curated model catalogue' }}
      rescanBusy={false}
      onRescan={vi.fn()}
      onSetParam={vi.fn()}
      onSetModelType={vi.fn()}
      onSetCandidate={vi.fn()}
      onAddModel={vi.fn()}
      {...overrides}
    />,
  );
}

describe('AiSdkProviderSheet', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders without per-column ⋮ menu buttons (company right-click contract)', () => {
    renderSheet();

    expect(screen.queryByRole('button', { name: /Column options:/i })).not.toBeInTheDocument();
    expect(screen.getByText(en.aiSdks.columns.id)).toBeInTheDocument();
  });

  it('opens a column context menu on header right-click', () => {
    renderSheet();

    const uuidHeader = screen.getByText(en.aiSdks.columns.id).closest('th');
    expect(uuidHeader).toBeTruthy();
    fireEvent.contextMenu(uuidHeader!);

    expect(screen.getByRole('menu', { name: en.aiSdks.menu.column })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: en.aiSdks.menu.sortAsc })).toBeInTheDocument();
  });

  it('shows Rescan and Add Model controls, not the removed legacy controls', () => {
    renderSheet();

    expect(screen.getByRole('button', { name: en.aiSdks.controls.rescan })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.aiSdks.controls.addModel })).toBeInTheDocument();
    expect(screen.queryByText('Add type')).not.toBeInTheDocument();
    expect(screen.queryByText('Restore defaults')).not.toBeInTheDocument();
  });

  it('invokes onRescan when Rescan is clicked', () => {
    const onRescan = vi.fn();
    renderSheet({ onRescan });

    fireEvent.click(screen.getByRole('button', { name: en.aiSdks.controls.rescan }));

    expect(onRescan).toHaveBeenCalledTimes(1);
  });
});
