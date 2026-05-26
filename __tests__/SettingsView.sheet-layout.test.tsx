import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SettingsView } from '../app/ui/views/SettingsView';
import { I18nProvider } from '../lib/i18n';

function renderSettingsView() {
  return render(
    <I18nProvider>
      <SettingsView />
    </I18nProvider>,
  );
}

describe('SettingsView sheet layout', () => {
  it('renders each settings block as a bottom sheet table', () => {
    renderSettingsView();

    expect(screen.getByRole('button', { name: /System Tray sheet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Runtime Bridge sheet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /System CLI Policy Preset sheet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Shortcuts sheet/i })).toBeInTheDocument();

    const activeTable = screen.getByRole('table');
    expect(within(activeTable).getByText('Setting')).toBeInTheDocument();
    expect(within(activeTable).getByText('Value')).toBeInTheDocument();
    expect(within(activeTable).getByText('State')).toBeInTheDocument();
    expect(within(activeTable).getByText('Action')).toBeInTheDocument();
    expect(within(activeTable).getByText('Enable on Launch')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Runtime Bridge sheet/i }));
    expect(screen.getByText('Mode')).toBeInTheDocument();
    expect(screen.getByText('Process Spawn')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /System CLI Policy Preset sheet/i }));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export JSON/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import JSON/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset to recommended/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save preset/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Shortcuts sheet/i }));
    expect(screen.getByText('Group')).toBeInTheDocument();
    expect(screen.getByText('Keys')).toBeInTheDocument();
    expect(screen.getByText('Open Projects')).toBeInTheDocument();
    expect(screen.getByText('Open Quick Dispatch overlay')).toBeInTheDocument();
  });
});
