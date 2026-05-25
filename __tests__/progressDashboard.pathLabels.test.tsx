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
    renderCell('spec');

    expect(screen.getByText('feature-spec.md')).toBeInTheDocument();
    expect(screen.queryByText('.project-manager/features/F01/feature-spec.md')).toBeNull();
    expect(screen.getByRole('button')).toHaveAttribute(
      'title',
      '/source-project/.project-manager/features/F01/feature-spec.md',
    );
  });

  it('opens markdown artifacts in the right-side document panel', () => {
    renderCell('spec');

    fireEvent.click(screen.getByRole('button'));

    expect(handlers.onOpenNotePanel).toHaveBeenCalledWith(
      '/source-project/.project-manager/features/F01/feature-spec.md',
    );
  });

  it('links the Dev Logs label to the canonical dev-log.md file', () => {
    renderCell('devLog');

    expect(screen.getByText('dev-log.md')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute(
      'title',
      '/source-project/.project-manager/features/F01/dev-log.md',
    );
  });

  it('shows Debug Retro and Test Scenarios as canonical artifact labels', () => {
    renderCell('debugRetro');
    expect(screen.getByText('debug-retro.md')).toBeInTheDocument();
    expect(screen.queryByText('.project-manager/features/F01/debug-retro.md')).toBeNull();
    expect(screen.getByRole('button')).toHaveAttribute(
      'title',
      '/source-project/.project-manager/features/F01/debug-retro.md',
    );

    renderCell('testScenarios');
    expect(screen.getByText('test-scenarios.md')).toBeInTheDocument();
    expect(screen.queryByText('.project-manager/features/F01/test-scenarios.md')).toBeNull();
    expect(screen.getAllByRole('button')[1]).toHaveAttribute(
      'title',
      '/source-project/.project-manager/features/F01/test-scenarios.md',
    );
  });

  it('shows README.md for the README column even when notes text exists', () => {
    const readmeColumn = createDevelopmentColumns().find((col) => col.id === 'notes');

    expect(readmeColumn?.header).toBe('README');
    renderCell('notes');
    expect(screen.getByText('README.md')).toBeInTheDocument();
    expect(screen.queryByText(row.notes!)).toBeNull();
  });

  it('does not show notes text as a README fallback when readmePath is missing', () => {
    renderCell('notes', { ...row, readmePath: undefined });

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText(row.notes!)).toBeNull();
  });
});
