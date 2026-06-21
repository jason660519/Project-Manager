import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DASHBOARD_SHEET_ORDER_STORAGE_KEY,
  normalizeSheetOrder,
  SheetTabs,
} from '../app/project-progress-dashboard/_components/SheetTabs';
import { I18nProvider } from '../lib/i18n';

function renderSheetTabs(onTabChange = vi.fn(), developmentLabel?: string) {
  render(
    <I18nProvider>
      <SheetTabs
        activeTab="development"
        onTabChange={onTabChange}
        phaseCounts={{
          development: 3,
          e2e_testing: 2,
          deployment: 1,
          operations: 0,
        }}
        projectCount={2}
        developmentLabel={developmentLabel}
      />
    </I18nProvider>,
  );
  return onTabChange;
}

describe('Project progress sheet tabs', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('places Issues directly after Projects', () => {
    renderSheetTabs();

    const buttons = screen.getAllByRole('button');
    expect(within(buttons[0]).getByText('Projects')).toBeInTheDocument();
    expect(within(buttons[1]).getByText('Issues')).toBeInTheDocument();
    expect(within(buttons[2]).getByText('Development Progress')).toBeInTheDocument();
  });

  it('emits the projects tab id when Projects is clicked', async () => {
    const onTabChange = renderSheetTabs();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /projects/i }));

    expect(onTabChange).toHaveBeenCalledWith('projects');
  });

  it('prefers the active development sheet label when provided', () => {
    renderSheetTabs(vi.fn(), 'Desktop App Development');
    expect(screen.getByRole('button', { name: /desktop app development sheet/i })).toBeInTheDocument();
  });

  it('persists user-reordered sheets after pointer drag', () => {
    renderSheetTabs();

    fireEvent.pointerDown(screen.getByRole('button', { name: /issues sheet/i }), { button: 0 });
    fireEvent.pointerEnter(screen.getByRole('button', { name: /projects sheet/i }));
    fireEvent.pointerUp(window);

    const buttons = screen.getAllByRole('button');
    expect(within(buttons[0]).getByText('Issues')).toBeInTheDocument();
    expect(within(buttons[1]).getByText('Projects')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(DASHBOARD_SHEET_ORDER_STORAGE_KEY) ?? '[]')).toEqual([
      'issues',
      'projects',
      'development',
      'e2e_testing',
      'deployment',
      'operations',
    ]);
  });

  it('normalizes invalid stored order by removing unknowns and appending missing sheets', () => {
    expect(normalizeSheetOrder(['operations', 'unknown', 'operations', 'projects'])).toEqual([
      'operations',
      'projects',
      'issues',
      'development',
      'e2e_testing',
      'deployment',
    ]);
  });
});
