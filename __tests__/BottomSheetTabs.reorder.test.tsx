import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BottomSheetTabs, type SheetTabItem } from '../components/sheets/BottomSheetTabs';
import { normalizeSheetOrder } from '../components/sheets/sheetOrder';

type TabKey = 'alpha' | 'beta' | 'gamma';

const STORAGE_KEY = 'projectManager.test.sheetOrder';
const TABS: ReadonlyArray<SheetTabItem<TabKey>> = [
  { key: 'alpha', label: 'Alpha' },
  { key: 'beta', label: 'Beta' },
  { key: 'gamma', label: 'Gamma' },
];

function renderTabs(onSelect = vi.fn()) {
  render(
    <BottomSheetTabs
      tabs={TABS}
      activeKey="alpha"
      onSelect={onSelect}
      reorderable
      orderStorageKey={STORAGE_KEY}
    />,
  );
  return onSelect;
}

describe('BottomSheetTabs reorder support', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('normalizes stored order by removing unknown ids, removing duplicates, and appending missing tabs', () => {
    expect(normalizeSheetOrder(['gamma', 'unknown', 'gamma'], ['alpha', 'beta', 'gamma'])).toEqual([
      'gamma',
      'alpha',
      'beta',
    ]);
  });

  it('hydrates persisted display order after mount', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['gamma', 'alpha', 'beta']));

    renderTabs();

    const buttons = screen.getAllByRole('button');
    expect(within(buttons[0]).getByText('Gamma')).toBeInTheDocument();
    expect(within(buttons[1]).getByText('Alpha')).toBeInTheDocument();
    expect(within(buttons[2]).getByText('Beta')).toBeInTheDocument();
  });

  it('reorders immediately on pointer enter and persists the canonical id order', () => {
    renderTabs();

    fireEvent.pointerDown(screen.getByRole('button', { name: /gamma sheet/i }), { button: 0 });
    fireEvent.pointerEnter(screen.getByRole('button', { name: /alpha sheet/i }));
    fireEvent.pointerUp(window);

    const buttons = screen.getAllByRole('button');
    expect(within(buttons[0]).getByText('Gamma')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual([
      'gamma',
      'alpha',
      'beta',
    ]);
  });

  it('suppresses the click emitted by a drag gesture', () => {
    const onSelect = renderTabs();
    const beta = screen.getByRole('button', { name: /beta sheet/i });

    fireEvent.pointerDown(screen.getByRole('button', { name: /alpha sheet/i }), { button: 0 });
    fireEvent.pointerEnter(beta);
    fireEvent.click(beta);
    fireEvent.pointerUp(window);

    expect(onSelect).not.toHaveBeenCalled();
  });
});
