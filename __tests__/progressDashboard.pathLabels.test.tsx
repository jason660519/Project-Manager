import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDevelopmentColumns, type ColumnHandlers } from '../app/project-progress-dashboard/_lib/columns';
import type { PhaseRow } from '../app/project-progress-dashboard/_lib/phaseRows';

const handlers: ColumnHandlers = {
  projectRoot: '/wrong-root',
  hiddenRowKeysSet: new Set(),
  onToggleHideRow: vi.fn(),
  onDeleteCustomRow: vi.fn(),
  onPatchFeature: vi.fn(),
  onPatchCustomRow: vi.fn(),
  onChangePhase: vi.fn(),
  onOpenNotePanel: vi.fn(),
};

const row: PhaseRow = {
  rowKey: 'feature::F01',
  source: 'feature',
  featureId: 'F01',
  sourceProjectRoot: '/source-project',
  uuid: '3b241101-e2bb-4255-8caf-4136c566a962',
  id: 'F01',
  name: 'Feature',
  category: 'Core',
  status: 'todo',
  progress: 0,
  points: 1,
  specPath: '.project-manager/features/F01/feature-spec.md',
  tddPath: '.project-manager/features/F01/tdd-spec.md',
  debugRetroPath: '.project-manager/features/F01/debug-retro.md',
  testScenariosPath: '.project-manager/features/F01/test-scenarios.md',
  devLogFolder: '.project-manager/features/F01/',
  notes: 'Short note that should not become the link label',
  readmePath: '.project-manager/features/F01/README.md',
};

function renderCell(columnId: string, targetRow: PhaseRow = row) {
  const column = createDevelopmentColumns().find((col) => col.id === columnId);
  if (!column) throw new Error(`Missing column ${columnId}`);
  render(<>{column.cell(targetRow, handlers)}</>);
}

describe('project progress path labels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows fixed document labels instead of raw paths', () => {
    renderCell('col-spec');

    expect(screen.getByText('feature-spec.md')).toBeInTheDocument();
    expect(screen.queryByText('.project-manager/features/F01/feature-spec.md')).toBeNull();
    expect(screen.getByRole('button')).toHaveAttribute(
      'title',
      '/source-project/.project-manager/features/F01/feature-spec.md',
    );
  });

  it('opens markdown artifacts in the right-side document panel', () => {
    renderCell('col-spec');

    fireEvent.click(screen.getByRole('button'));

    expect(handlers.onOpenNotePanel).toHaveBeenCalledWith(
      '/source-project/.project-manager/features/F01/feature-spec.md',
    );
  });

  it('links the Dev Logs label to the canonical dev-log.md file', () => {
    renderCell('col-dev-log');

    expect(screen.getByText('dev-log.md')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute(
      'title',
      '/source-project/.project-manager/features/F01/dev-log.md',
    );
  });

  it('shows Debug Retro and Test Scenarios as canonical artifact labels', () => {
    renderCell('col-debug-retro');
    expect(screen.getByText('debug-retro.md')).toBeInTheDocument();
    expect(screen.queryByText('.project-manager/features/F01/debug-retro.md')).toBeNull();
    expect(screen.getByRole('button')).toHaveAttribute(
      'title',
      '/source-project/.project-manager/features/F01/debug-retro.md',
    );

    renderCell('col-test-scenarios');
    expect(screen.getByText('test-scenarios.md')).toBeInTheDocument();
    expect(screen.queryByText('.project-manager/features/F01/test-scenarios.md')).toBeNull();
    expect(screen.getAllByRole('button')[1]).toHaveAttribute(
      'title',
      '/source-project/.project-manager/features/F01/test-scenarios.md',
    );
  });

  it('shows README.md for the README column even when notes text exists', () => {
    const readmeColumn = createDevelopmentColumns().find((col) => col.id === 'col-notes');

    expect(readmeColumn?.header).toBe('README');
    renderCell('col-notes');
    expect(screen.getByText('README.md')).toBeInTheDocument();
    expect(screen.queryByText(row.notes!)).toBeNull();
  });

  it('does not show notes text as a README fallback when readmePath is missing', () => {
    renderCell('col-notes', { ...row, readmePath: undefined });

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText(row.notes!)).toBeNull();
  });
});
