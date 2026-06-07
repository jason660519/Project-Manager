import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../lib/i18n';
import { CompanyStandardsView } from '../app/ui/views/CompanyStandardsView';

vi.mock('../lib/bridge', () => ({
  openPath: vi.fn(),
}));

const baseProps = {
  dashboardScopeProjects: [
    {
      id: 'project-manager',
      configPath: '/repo/Project-Manager/.project-manager/config.json',
      config: {
        schemaVersion: 6,
        project: { name: 'Project Manager', root: '/repo/Project-Manager' },
        features: [],
      } as unknown as import('../lib/types').ProjectEntry['config'],
    },
  ],
  canRunGates: false,
  gatePhases: {},
  runAllProgress: null,
  gateRunMessage: null,
  anyGateRunning: false,
  onRunGate: vi.fn(),
  onRunAllBlocking: vi.fn(),
};

function renderHub(overrides: Partial<typeof baseProps> = {}) {
  return render(
    <I18nProvider>
      <CompanyStandardsView {...baseProps} {...overrides} />
    </I18nProvider>,
  );
}

describe('CompanyStandardsView', () => {
  it('renders the layered company standards hub', () => {
    renderHub();

    const governedCard = screen.getByText('Governed Apps').closest('div');
    expect(governedCard).toBeTruthy();
    expect(governedCard).toHaveTextContent('1');
    expect(governedCard).toHaveTextContent('Project Manager');

    expect(screen.getByRole('heading', { name: 'Company Standards Hub' })).toBeInTheDocument();
    expect(screen.getByText('Separate Common Standards From App Profiles')).toBeInTheDocument();
    expect(screen.getByText('Foundations')).toBeInTheDocument();
    expect(screen.getByText('Package Only What Has Stabilized')).toBeInTheDocument();
    expect(screen.getByText('Open Standards Sources')).toBeInTheDocument();
  });

  it('shows guarded gates section copy and disabled run-all in browser mode', () => {
    renderHub();
    expect(screen.getByText('Run registered project gates')).toBeInTheDocument();
    const runAll = screen.getByRole('button', { name: 'Run blocking gates' });
    expect(runAll).toBeDisabled();
    expect(
      screen.getByText(/Run requires the Project Manager desktop app/i),
    ).toBeInTheDocument();
  });

  it('enables per-gate run when canRunGates is true', () => {
    renderHub({ canRunGates: true });
    const runButtons = screen.getAllByRole('button', { name: 'Run' });
    expect(runButtons.length).toBeGreaterThanOrEqual(2);
    expect(runButtons[0]).not.toBeDisabled();
  });

  it('calls onRunGate when Run is clicked', async () => {
    const onRunGate = vi.fn();
    const user = userEvent.setup();
    renderHub({ canRunGates: true, onRunGate });
    const runButtons = screen.getAllByRole('button', { name: 'Run' });
    await user.click(runButtons[0]);
    expect(onRunGate).toHaveBeenCalledWith('i18n');
  });

  it('shows pass badge when gate phase is pass', () => {
    renderHub({ gatePhases: { i18n: 'pass' } });
    expect(screen.getByText('Pass')).toBeInTheDocument();
  });
});
