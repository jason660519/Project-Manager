import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '../../lib/i18n';
import { RunsView } from '../../app/ui/views/RunsView';
import type { ActiveRun, CompletedRun } from '../../lib/types';

const now = Date.now();

const mockActiveRuns: ActiveRun[] = [
  {
    pid: 1001,
    featureId: 'F03',
    featureName: 'Live Run Inspector',
    command: 'cursor',
    args: ['--task', 'F03'],
    startedAt: now - 35000,
    logs: ['Starting...', 'Processing spec...'],
    phase: 'running',
  },
  {
    pid: 1002,
    featureId: 'F12',
    featureName: 'Skills Page',
    command: 'codex',
    args: ['--spec', 'F12', '--tdd', 'F12'],
    startedAt: now - 12000,
    logs: [],
    phase: 'running',
  },
];

const mockCompletedRuns: CompletedRun[] = [
  {
    pid: 9001,
    featureId: 'F01',
    featureName: 'Sidebar Nav',
    command: 'cursor',
    args: ['--task', 'F01'],
    startedAt: now - 120000,
    completedAt: now - 60000,
    exitCode: 0,
    success: true,
    logs: ['Done. All good.'],
  },
  {
    pid: 9002,
    featureId: 'F02',
    featureName: 'Filter Tabs',
    command: 'cursor',
    args: ['--task', 'F02'],
    startedAt: now - 300000,
    completedAt: now - 180000,
    exitCode: 1,
    success: false,
    logs: ['Error: build failed'],
  },
];

const mockPendingRun: ActiveRun = {
  pid: 1003,
  featureId: 'F14',
  featureName: 'Pending Dispatch',
  command: 'codex',
  args: ['--task', 'F14'],
  startedAt: now - 1000,
  logs: ['should stay hidden until running'],
  phase: 'pending',
};

function renderView(activeRuns?: ActiveRun[], runHistory?: CompletedRun[]) {
  const onKillRun = vi.fn();
  return {
    onKillRun,
    ...render(
      <I18nProvider>
        <RunsView
          activeRuns={activeRuns ?? []}
          runHistory={runHistory ?? []}
          onKillRun={onKillRun}
        />
      </I18nProvider>,
    ),
  };
}

// ── Suite A: Component Rendering ──────────────────────────────────────────────

describe('RunsView — rendering', () => {
  it('A1: renders active runs list', () => {
    renderView(mockActiveRuns, []);

    expect(screen.getByText('Live Run Inspector')).toBeInTheDocument();
    expect(screen.getByText('PID 1001')).toBeInTheDocument();
    expect(screen.getByText('Skills Page')).toBeInTheDocument();
    expect(screen.getByText('PID 1002')).toBeInTheDocument();
    expect(screen.getByText(/cursor --task F03/)).toBeInTheDocument();

    // Kill buttons
    const killButtons = screen.getAllByText('Kill');
    expect(killButtons).toHaveLength(2);

    // View Log buttons
    const viewLogButtons = screen.getAllByText('View Log');
    expect(viewLogButtons).toHaveLength(2);
  });

  it('A2: renders run history', () => {
    renderView([], mockCompletedRuns);

    expect(screen.getByText('Sidebar Nav')).toBeInTheDocument();
    expect(screen.getByText('Filter Tabs')).toBeInTheDocument();
    expect(screen.getByText(/exit 0/)).toBeInTheDocument();
    expect(screen.getByText(/exit 1/)).toBeInTheDocument();
  });

  it('A3: renders empty history state', () => {
    renderView(mockActiveRuns, []);

    expect(screen.getByText('No runs yet in this session.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Dispatch a feature from Dashboard or Features to see history here.',
      ),
    ).toBeInTheDocument();

    // Active runs section still visible
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Live Run Inspector')).toBeInTheDocument();
  });

  it('A4: toggles log view on active run', () => {
    renderView(mockActiveRuns, []);

    // Initially not visible
    expect(screen.queryByText('Processing spec...')).not.toBeInTheDocument();

    // Click View Log on first run
    const viewButtons = screen.getAllByText('View Log');
    fireEvent.click(viewButtons[0]);
    expect(screen.getByText('Processing spec...')).toBeInTheDocument();

    // Click Hide Log
    const hideButton = screen.getByText('Hide Log');
    fireEvent.click(hideButton);
    expect(screen.queryByText('Processing spec...')).not.toBeInTheDocument();
  });

  it('A5: "Waiting for output…" when active run has empty logs', () => {
    renderView(mockActiveRuns, []);

    const viewButtons = screen.getAllByText('View Log');
    // Second run (PID 1002) has empty logs
    fireEvent.click(viewButtons[1]);
    expect(screen.getByText('Waiting for output…')).toBeInTheDocument();
  });

  it('A5b: pending active run shows preparing indicator and hides live logs', () => {
    renderView([mockPendingRun], []);

    expect(screen.getByText('Preparing…')).toBeInTheDocument();
    fireEvent.click(screen.getByText('View Log'));
    expect(screen.queryByText('should stay hidden until running')).not.toBeInTheDocument();
    expect(screen.queryByText('Waiting for output…')).not.toBeInTheDocument();
  });

  it('A6: toggles log view on history item', () => {
    renderView([], mockCompletedRuns);

    expect(screen.queryByText('Done. All good.')).not.toBeInTheDocument();

    // Click first history row
    fireEvent.click(screen.getByText('Sidebar Nav'));
    expect(screen.getByText('Done. All good.')).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(screen.getByText('Sidebar Nav'));
    expect(screen.queryByText('Done. All good.')).not.toBeInTheDocument();
  });

  it('A7: success icon vs failure icon', () => {
    renderView([], mockCompletedRuns);

    // Can't easily check SVG classes in jsdom, but we can check exit code colors
    const exit0 = screen.getByText(/exit 0/);
    const exit1 = screen.getByText(/exit 1/);
    expect(exit0.className).toContain('emerald');
    expect(exit1.className).toContain('red');
  });

  it('A8: renders all-active-empty-history header', () => {
    renderView(mockActiveRuns, []);

    // Header should show active count
    expect(screen.getByText(/2 run\(s\) active/)).toBeInTheDocument();
    expect(screen.getByText(/0 history/)).toBeInTheDocument();
  });
});

// ── Suite B: Kill Confirmation ─────────────────────────────────────────────────

describe('RunsView — kill confirmation', () => {
  it('B1: clicking Kill shows confirmation dialog', () => {
    const { onKillRun } = renderView(mockActiveRuns, []);

    const killButtons = screen.getAllByText('Kill');
    fireEvent.click(killButtons[0]);

    // Confirmation UI visible
    expect(screen.getByText('Kill this run?')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();

    // No kill fired yet
    expect(onKillRun).not.toHaveBeenCalled();
  });

  it('B2: confirming kill fires onKillRun with correct PID', () => {
    const { onKillRun } = renderView(mockActiveRuns, []);

    const killButtons = screen.getAllByText('Kill');
    fireEvent.click(killButtons[0]); // First run = PID 1001

    fireEvent.click(screen.getByText('Confirm'));

    expect(onKillRun).toHaveBeenCalledTimes(1);
    expect(onKillRun).toHaveBeenCalledWith(1001);
  });

  it('B3: cancelling kill hides dialog without firing onKillRun', () => {
    const { onKillRun } = renderView(mockActiveRuns, []);

    const killButtons = screen.getAllByText('Kill');
    fireEvent.click(killButtons[0]);

    fireEvent.click(screen.getByText('Cancel'));

    expect(onKillRun).not.toHaveBeenCalled();

    // Dialog hidden, Kill button visible again
    expect(screen.queryByText('Kill this run?')).not.toBeInTheDocument();
    expect(screen.getAllByText('Kill')).toHaveLength(2);
  });

  it('B4: confirmation is per-run (not shared state)', () => {
    renderView(mockActiveRuns, []);

    const killButtons = screen.getAllByText('Kill');
    fireEvent.click(killButtons[0]); // PID 1001

    // Confirmation visible for PID 1001
    expect(screen.getByText('Kill this run?')).toBeInTheDocument();

    // PID 1002 should still just show "Kill"
    expect(killButtons[1]).toBeInTheDocument();
    expect(killButtons[1].textContent).toBe('Kill');
  });
});

// ── Suite C: Empty states ─────────────────────────────────────────────────────

describe('RunsView — empty states', () => {
  it('C1: renders empty state when no active runs and no history', () => {
    renderView([], []);

    expect(screen.getByText('No runs yet in this session.')).toBeInTheDocument();

    // No active section header
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  it('C2: renders empty history but active runs visible', () => {
    renderView(mockActiveRuns, []);

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.queryByText('No runs yet in this session.')).toBeInTheDocument();
  });
});
