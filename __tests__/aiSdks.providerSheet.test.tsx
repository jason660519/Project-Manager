import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AiSdkProviderSheet } from '../app/ui/views/AiSdks/AiSdkProviderSheet';
import { emptyAiSdksConfig } from '../lib/aiSdks/store';
import { en } from '../lib/i18n/en';

function renderSheet() {
  return render(
    <AiSdkProviderSheet
      providerId="anthropic"
      store={emptyAiSdksConfig()}
      categories={['LLM', 'VLM']}
      readOnly={false}
      copy={en.aiSdks}
      onSetParam={vi.fn()}
      onSetModelType={vi.fn()}
      onSetCandidate={vi.fn()}
      onAddModel={vi.fn()}
      onAddCategory={vi.fn()}
      onRestoreProviderDefaults={vi.fn()}
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
});
