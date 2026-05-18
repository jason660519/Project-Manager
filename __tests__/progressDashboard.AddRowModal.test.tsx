import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddRowModal } from '../app/project-progress-dashboard/_components/AddRowModal';
import { DEFAULT_E2E_CATEGORY } from '../app/project-progress-dashboard/_lib/e2eCategories';

const renderOpen = (
  phase: 'development' | 'e2e_testing' | 'deployment' | 'operations',
  onAdd = vi.fn(),
  opts: { defaultProjectName?: string; projectNames?: string[] } = {},
) => {
  const onClose = vi.fn();
  render(
    <AddRowModal
      open
      onClose={onClose}
      phase={phase}
      defaultProjectName={opts.defaultProjectName ?? 'Demo Project'}
      projectNames={opts.projectNames}
      existingIds={new Set()}
      onAdd={onAdd}
    />,
  );
  return { onAdd, onClose };
};

describe('AddRowModal phase-aware fields', () => {
  it('does not show testing/deployment/ops fields on the development phase', () => {
    renderOpen('development');
    expect(screen.getByText('專案名稱 *')).toBeInTheDocument();
    expect(screen.getByText('SP')).toBeInTheDocument();
    expect(screen.queryByText('Test Coverage %')).toBeNull();
    expect(screen.queryByText('Deploy Status')).toBeNull();
    expect(screen.queryByText('Uptime %')).toBeNull();
  });

  it('shows a project picker when multiple dashboard projects are visible', () => {
    renderOpen('development', vi.fn(), {
      defaultProjectName: 'Alpha',
      projectNames: ['Alpha', 'Beta'],
    });
    expect(screen.getByLabelText('專案名稱')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Beta' })).toBeInTheDocument();
  });

  it('shows testCoverage + testStatus on the e2e_testing phase', () => {
    renderOpen('e2e_testing');
    expect(screen.getByText('Test Coverage %')).toBeInTheDocument();
    expect(screen.getByText('Test Status')).toBeInTheDocument();
  });

  it('shows an E2E category select (not free text) on the e2e_testing phase', () => {
    renderOpen('e2e_testing');
    expect(screen.getByLabelText('E2E category')).toBeInTheDocument();
    expect(screen.getByText(/專案內跨 features/)).toBeInTheDocument();
  });

  it('shows deployStatus / environment / date on the deployment phase', () => {
    renderOpen('deployment');
    expect(screen.getByText('Deploy Status')).toBeInTheDocument();
    expect(screen.getByText('Environment')).toBeInTheDocument();
    expect(screen.getByText('Deploy Date')).toBeInTheDocument();
  });

  it('shows uptime / error / response / last-incident on the operations phase', () => {
    renderOpen('operations');
    expect(screen.getByText('Uptime %')).toBeInTheDocument();
    expect(screen.getByText('Error %')).toBeInTheDocument();
    expect(screen.getByText('Response (ms)')).toBeInTheDocument();
    expect(screen.getByText('Last Incident')).toBeInTheDocument();
  });
});

describe('AddRowModal submission payloads', () => {
  it('emits an e2e_testing-phase row with parsed coverage + status', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderOpen('e2e_testing');

    await user.type(screen.getByPlaceholderText('e.g. C-001'), 'C-T1');
    await user.type(screen.getByLabelText('Name *'), 'My test row');
    await user.type(screen.getByPlaceholderText('0-100'), '85');
    await user.selectOptions(screen.getByLabelText('Test Status'), 'passed');

    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const payload = onAdd.mock.calls[0][0];
    expect(payload.rowId).toBe('C-T1');
    expect(payload.phase).toBe('e2e_testing');
    expect(payload.category).toBe(DEFAULT_E2E_CATEGORY);
    expect(payload.testCoverage).toBe(85);
    expect(payload.testStatus).toBe('passed');
    // Fields irrelevant to this phase stay undefined so the JSON stays tidy.
    expect(payload.deployStatus).toBeUndefined();
    expect(payload.uptimePercent).toBeUndefined();
  });

  it('clamps over-range testCoverage to [0,100]', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderOpen('e2e_testing');

    await user.type(screen.getByPlaceholderText('e.g. C-001'), 'C-T2');
    await user.type(screen.getByLabelText('Name *'), 'Row');
    await user.type(screen.getByPlaceholderText('0-100'), '9999');

    await user.click(screen.getByRole('button', { name: /add/i }));
    expect(onAdd.mock.calls[0][0].testCoverage).toBe(100);
  });

  it('emits projectName and points on a development-phase row', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderOpen('development', vi.fn(), { defaultProjectName: 'My App' });

    await user.type(screen.getByPlaceholderText('e.g. C-001'), 'C-D1');
    fireEvent.change(screen.getByLabelText('SP'), { target: { value: '3' } });
    await user.type(screen.getByLabelText('Name *'), 'Custom task');

    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(onAdd.mock.calls[0][0]).toMatchObject({
      rowId: 'C-D1',
      projectName: 'My App',
      points: 3,
      phase: 'development',
    });
  });

  it('rejects empty rowId with an inline error', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderOpen('development');
    await user.click(screen.getByRole('button', { name: /add/i }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText('Row ID is required')).toBeInTheDocument();
  });

  it('rejects a duplicate rowId already present in existingIds', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(
      <AddRowModal
        open
        onClose={vi.fn()}
        phase="development"
        defaultProjectName="Demo Project"
        existingIds={new Set(['DUP'])}
        onAdd={onAdd}
      />,
    );
    await user.type(screen.getByPlaceholderText('e.g. C-001'), 'DUP');
    await user.type(screen.getByLabelText('Name *'), 'name');
    await user.click(screen.getByRole('button', { name: /add/i }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText(/already exists/)).toBeInTheDocument();
  });
});
