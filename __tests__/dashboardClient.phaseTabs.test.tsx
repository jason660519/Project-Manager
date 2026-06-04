import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DashboardClient } from '../app/ui/DashboardClient';
import type { Feature, FeaturePhase, ProjectConfig } from '../lib/types';

const STORAGE_KEY =
  'projectManager.personal.dashboard.phaseFilter:%2Ftmp%2Fproject-manager-test';

const project: ProjectConfig = {
  name: 'Project Manager Test',
  root: '/tmp/project-manager-test',
  defaultIDE: 'Cursor',
};

const noop = () => {};

function feature(
  id: string,
  name: string,
  phase?: FeaturePhase,
  status: Feature['status'] = 'todo',
): Feature {
  return {
    id,
    name,
    category: 'Frontend',
    status,
    progress: status === 'done' ? 100 : 10,
    paths: {},
    ...(phase ? { phase } : {}),
  };
}

const fixtures: Feature[] = [
  feature('F01', 'Explicit Development Feature', 'development', 'in_progress'),
  feature('F02', 'Implicit Development Feature'),
  feature('F03', 'E2E Testing Feature', 'e2e_testing'),
  feature('F04', 'Deployment Feature', 'deployment'),
  feature('F05', 'Operations Feature', 'operations'),
];

function renderDashboard(features = fixtures) {
  return render(
    <DashboardClient
      project={project}
      features={features}
      adapters={[]}
      activeRuns={[]}
      runHistory={[]}
      onRunStart={noop}
      onRunLog={noop}
      onRunEnd={noop}
    />,
  );
}

function setUrl(search = '') {
  window.history.replaceState(null, '', `/${search}`);
}

function expectVisible(names: string[]) {
  for (const name of names) {
    expect(screen.getByText(name)).toBeInTheDocument();
  }
}

function expectHidden(names: string[]) {
  for (const name of names) {
    expect(screen.queryByText(name)).not.toBeInTheDocument();
  }
}

function tab(label: string) {
  return screen.getByRole('tab', { name: new RegExp(label, 'i') });
}

describe('DashboardClient phase tabs: render and filtering', () => {
  it('renders the four lifecycle tabs and defaults to Development Progress', () => {
    setUrl();
    renderDashboard();

    expect(tab('Development Progress')).toHaveAttribute('aria-selected', 'true');
    expect(tab('E2E Testing')).toBeInTheDocument();
    expect(tab('Deployment')).toBeInTheDocument();
    expect(tab('Operations')).toBeInTheDocument();
  });

  it('filters the feature list by selected lifecycle tab', async () => {
    setUrl();
    const user = userEvent.setup();
    renderDashboard();

    expectVisible(['Explicit Development Feature', 'Implicit Development Feature']);
    expectHidden(['E2E Testing Feature', 'Deployment Feature', 'Operations Feature']);

    await user.click(tab('E2E Testing'));
    expectVisible(['E2E Testing Feature']);
    expectHidden(['Explicit Development Feature', 'Implicit Development Feature', 'Deployment Feature']);

    await user.click(tab('Deployment'));
    expectVisible(['Deployment Feature']);
    expectHidden(['E2E Testing Feature', 'Operations Feature']);

    await user.click(tab('Operations'));
    expectVisible(['Operations Feature']);
    expectHidden(['E2E Testing Feature', 'Deployment Feature']);
  });

  it('treats a missing feature phase as Development', async () => {
    setUrl();
    const user = userEvent.setup();
    renderDashboard();

    expect(screen.getByText('Implicit Development Feature')).toBeInTheDocument();

    await user.click(tab('E2E Testing'));
    expect(screen.queryByText('Implicit Development Feature')).not.toBeInTheDocument();
  });
});

describe('DashboardClient phase tabs: localStorage persistence', () => {
  it('saves the active phase to project-scoped localStorage', async () => {
    setUrl();
    const user = userEvent.setup();
    renderDashboard();

    await user.click(tab('Operations'));

    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBe('operations'));
  });

  it('restores the active phase from localStorage', async () => {
    setUrl();
    localStorage.setItem(STORAGE_KEY, 'deployment');

    renderDashboard();

    expect(tab('Deployment')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Deployment Feature')).toBeInTheDocument();
  });

  it('ignores invalid stored phases', () => {
    setUrl();
    localStorage.setItem(STORAGE_KEY, 'not_a_phase');

    renderDashboard();

    expect(tab('Development Progress')).toHaveAttribute('aria-selected', 'true');
  });

  it('continues filtering when localStorage throws', async () => {
    setUrl();
    const getItem = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    const user = userEvent.setup();

    renderDashboard();
    await user.click(tab('Deployment'));

    expect(screen.getByText('Deployment Feature')).toBeInTheDocument();

    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe('DashboardClient phase tabs: URL sync', () => {
  it('uses URL phase before localStorage', () => {
    setUrl('?phase=e2e_testing');
    localStorage.setItem(STORAGE_KEY, 'deployment');

    renderDashboard();

    expect(tab('E2E Testing')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('E2E Testing Feature')).toBeInTheDocument();
  });

  it('updates the URL phase param and preserves unrelated params', async () => {
    setUrl('?foo=bar');
    const user = userEvent.setup();
    renderDashboard();

    await user.click(tab('Deployment'));

    await waitFor(() => expect(window.location.search).toContain('phase=deployment'));
    expect(window.location.search).toContain('foo=bar');
  });

  it('preserves the dispatch param while changing phases', async () => {
    setUrl('?dispatch=F99');
    const user = userEvent.setup();
    renderDashboard();

    await user.click(tab('Operations'));

    await waitFor(() => expect(window.location.search).toContain('phase=operations'));
    expect(window.location.search).toContain('dispatch=F99');
  });

  it('updates the selected tab on browser back navigation', async () => {
    setUrl();
    const user = userEvent.setup();
    renderDashboard();

    await user.click(tab('E2E Testing'));
    await waitFor(() => expect(window.location.search).toContain('phase=e2e_testing'));

    await user.click(tab('Deployment'));
    await waitFor(() => expect(window.location.search).toContain('phase=deployment'));

    window.history.back();
    window.dispatchEvent(new PopStateEvent('popstate'));

    await waitFor(() => expect(tab('E2E Testing')).toHaveAttribute('aria-selected', 'true'));
    expect(screen.getByText('E2E Testing Feature')).toBeInTheDocument();
  });

  it('repairs an invalid URL phase to Development Progress', async () => {
    setUrl('?phase=bad_value');

    renderDashboard();

    expect(tab('Development Progress')).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(window.location.search).toContain('phase=development'));
    expect(window.location.search).not.toContain('bad_value');
  });
});

describe('DashboardClient phase tabs: count badges', () => {
  it('shows counts for every phase', () => {
    setUrl();
    renderDashboard();

    expect(screen.getByLabelText('2 Development Progress features')).toHaveTextContent('2');
    expect(screen.getByLabelText('1 E2E Testing features')).toHaveTextContent('1');
    expect(screen.getByLabelText('1 Deployment features')).toHaveTextContent('1');
    expect(screen.getByLabelText('1 Operations features')).toHaveTextContent('1');
  });

  it('updates counts when incoming features change', () => {
    setUrl();
    const { rerender } = renderDashboard();

    rerender(
      <DashboardClient
        project={project}
        features={[...fixtures, feature('F06', 'Second Operations Feature', 'operations')]}
        adapters={[]}
        activeRuns={[]}
        runHistory={[]}
        onRunStart={noop}
        onRunLog={noop}
        onRunEnd={noop}
      />,
    );

    expect(screen.getByLabelText('2 Operations features')).toHaveTextContent('2');
  });

  it('counts missing phases under Development Progress', () => {
    setUrl();
    renderDashboard();

    expect(screen.getByLabelText('2 Development Progress features')).toHaveTextContent('2');
  });
});

describe('DashboardClient phase tabs: transition animation', () => {
  it('adds transition styling to the feature list wrapper', () => {
    setUrl();
    renderDashboard();

    expect(screen.getByTestId('feature-phase-transition')).toHaveClass(
      'transition-[opacity,transform]',
      'duration-150',
    );
  });

  it('keeps the table reachable after switching tabs', async () => {
    setUrl();
    const user = userEvent.setup();
    renderDashboard();

    await user.click(tab('Operations'));

    expect(screen.getByTestId('feature-phase-transition')).toBeInTheDocument();
    expect(screen.getByText('Operations Feature')).toBeInTheDocument();
  });
});
