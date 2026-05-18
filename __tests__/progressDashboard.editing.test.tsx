import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Feature } from '../lib/types';
import type { CustomProjectProgressRow } from '../app/project-progress-dashboard/types';
import {
  columnsForPhase,
  type ColumnHandlers,
} from '../app/project-progress-dashboard/_lib/columns';
import {
  customRowToPhaseRow,
  featureToPhaseRow,
  type PhaseRow,
} from '../app/project-progress-dashboard/_lib/phaseRows';

const baseFeature = (overrides: Partial<Feature> = {}): Feature => ({
  id: overrides.id ?? 'F01',
  name: overrides.name ?? 'feat',
  category: overrides.category ?? 'cat',
  status: overrides.status ?? 'todo',
  progress: overrides.progress ?? 0,
  paths: {},
  ...overrides,
});

const baseCustom = (overrides: Partial<CustomProjectProgressRow> = {}): CustomProjectProgressRow => ({
  rowId: overrides.rowId ?? 'C-1',
  name: 'custom',
  category: 'Custom',
  percentage: 0,
  phase: overrides.phase ?? 'development',
  ...overrides,
});

const noopHandlers = (): ColumnHandlers => ({
  projectRoot: '/tmp/project',
  engineerRoles: [],
  hiddenRowKeysSet: new Set(),
  onToggleHideRow: vi.fn(),
  onOpenPromptConfig: vi.fn(),
  onDeleteCustomRow: vi.fn(),
  onPatchFeature: vi.fn(),
  onPatchCustomRow: vi.fn(),
  onChangePhase: vi.fn(),
});

/** Render a single cell out of a phase's column factory and return both element + handlers spy. */
function renderCell(
  phase: 'development' | 'e2e_testing' | 'deployment' | 'operations',
  colId: string,
  row: PhaseRow,
  hOverrides: Partial<ColumnHandlers> = {},
) {
  const handlers: ColumnHandlers = { ...noopHandlers(), ...hOverrides };
  const col = columnsForPhase(phase).find((c) => c.id === colId);
  if (!col) throw new Error(`column ${colId} missing on phase ${phase}`);
  const utils = render(<div>{col.cell(row, handlers)}</div>);
  return { ...utils, handlers };
}

describe('column cell editing — feature rows route through onPatchFeature', () => {
  it('SP cell on dev tab commits a numeric points patch', async () => {
    const user = userEvent.setup();
    const row = featureToPhaseRow(baseFeature({ id: 'F01', points: 1 }));
    const onPatchFeature = vi.fn();
    renderCell('development', 'points', row, { onPatchFeature });

    // The cell starts in display mode showing "1"; click to enter edit mode.
    await user.click(screen.getByRole('button', { name: '1' }));
    const input = screen.getByDisplayValue('1') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, '5');
    fireEvent.blur(input);

    expect(onPatchFeature).toHaveBeenCalledTimes(1);
    expect(onPatchFeature).toHaveBeenCalledWith('F01', { points: 5 });
  });

  it('testStatus select on e2e_testing tab commits the new value', async () => {
    const user = userEvent.setup();
    const row = featureToPhaseRow(baseFeature({ id: 'F02', phase: 'e2e_testing' }));
    const onPatchFeature = vi.fn();
    renderCell('e2e_testing', 'testStatus', row, { onPatchFeature });

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    await user.selectOptions(select, 'passed');

    expect(onPatchFeature).toHaveBeenCalledWith('F02', { testStatus: 'passed' });
  });

  it('deployStatus select on deployment tab commits the new value', async () => {
    const user = userEvent.setup();
    const row = featureToPhaseRow(baseFeature({ id: 'F03', phase: 'deployment' }));
    const onPatchFeature = vi.fn();
    renderCell('deployment', 'deployStatus', row, { onPatchFeature });
    await user.selectOptions(screen.getByRole('combobox'), 'production');
    expect(onPatchFeature).toHaveBeenCalledWith('F03', { deployStatus: 'production' });
  });

  it('uptime cell on operations tab commits a numeric uptimePercent patch', async () => {
    const user = userEvent.setup();
    const row = featureToPhaseRow(baseFeature({ id: 'F04', phase: 'operations' }));
    const onPatchFeature = vi.fn();
    renderCell('operations', 'uptime', row, { onPatchFeature });

    await user.click(screen.getByRole('button')); // enter edit
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, '99.9');
    fireEvent.blur(input);

    expect(onPatchFeature).toHaveBeenCalledWith('F04', { uptimePercent: 99.9 });
  });
});

describe('column cell editing — custom rows route through onPatchCustomRow', () => {
  it('SP edit on a custom dev row patches the custom row, not the feature store', async () => {
    const user = userEvent.setup();
    const row = customRowToPhaseRow(baseCustom({ rowId: 'C-9', phase: 'development' }));
    const onPatchFeature = vi.fn();
    const onPatchCustomRow = vi.fn();
    renderCell('development', 'page', row, { onPatchFeature, onPatchCustomRow });

    await user.click(screen.getByRole('button')); // page cell starts with "—" placeholder
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.type(input, 'app/page.tsx');
    fireEvent.blur(input);

    expect(onPatchFeature).not.toHaveBeenCalled();
    expect(onPatchCustomRow).toHaveBeenCalledWith('C-9', { locatedPage: 'app/page.tsx' });
  });
});

describe('phase switcher in actions column', () => {
  it('moving a feature row to e2e_testing calls onChangePhase with the new phase', async () => {
    const user = userEvent.setup();
    const row = featureToPhaseRow(baseFeature({ id: 'F10', phase: 'development' }));
    const onChangePhase = vi.fn();
    renderCell('development', 'actions', row, { onChangePhase });

    // The phase select is the first <select> in the actions cell.
    const phaseSelect = screen.getByTitle('Move feature to another phase') as HTMLSelectElement;
    await user.selectOptions(phaseSelect, 'e2e_testing');

    expect(onChangePhase).toHaveBeenCalledTimes(1);
    expect(onChangePhase).toHaveBeenCalledWith(row, 'e2e_testing');
  });
});

describe('feature-only Dispatch button', () => {
  it('renders for feature rows when onDispatch is provided', () => {
    const row = featureToPhaseRow(baseFeature({ id: 'F11' }));
    const onDispatch = vi.fn();
    renderCell('development', 'actions', row, { onDispatch });
    expect(screen.getByTitle('Dispatch to agent')).toBeInTheDocument();
  });

  it('is hidden for custom rows even when onDispatch is provided', () => {
    const row = customRowToPhaseRow(baseCustom({ rowId: 'C-11' }));
    const onDispatch = vi.fn();
    renderCell('development', 'actions', row, { onDispatch });
    expect(screen.queryByTitle('Dispatch to agent')).toBeNull();
  });

  it('is hidden for feature rows when onDispatch is undefined', () => {
    const row = featureToPhaseRow(baseFeature({ id: 'F12' }));
    renderCell('development', 'actions', row);
    expect(screen.queryByTitle('Dispatch to agent')).toBeNull();
  });
});
