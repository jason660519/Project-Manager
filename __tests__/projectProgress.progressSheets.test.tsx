import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectProgressClient } from '../app/project-progress-dashboard/ProjectProgressClient';
import { createProgressSheetConfigFromTemplate } from '../lib/progress-sheets/sheetConfig';
import { I18nProvider } from '../lib/i18n';
import type {
  ProgressSheetConfig,
  ProjectManagerConfig,
  ProjectProgressSheetRef,
} from '../lib/types';

const bridgeMock = vi.hoisted(() => ({
  readJsonFile: vi.fn(),
}));

vi.mock('../lib/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/bridge')>();
  return {
    ...actual,
    readJsonFile: bridgeMock.readJsonFile,
  };
});

const now = '2026-06-20T00:00:00.000Z';

function sheetRef(id: string, label: string, configPath: string): ProjectProgressSheetRef {
  return {
    id,
    label,
    discipline: id === 'marketing-campaign' ? 'marketing-campaign' : 'software',
    configPath,
    templateId: id,
    templateVersion: 1,
    active: id === 'marketing-campaign',
    createdAt: now,
    updatedAt: now,
  };
}

function projectConfig(progressSheets: ProjectProgressSheetRef[]): ProjectManagerConfig {
  return {
    schemaVersion: 11,
    id: 'project-1',
    project: {
      name: 'Launch Project',
      root: '/workspace/launch',
      defaultIDE: 'VSCode',
    },
    features: [],
    adapters: { ides: [], agents: [], apps: [] },
    progressSheets,
  };
}

function dashboardNode(config: ProjectManagerConfig) {
  return (
    <I18nProvider>
      <ProjectProgressClient
        project={config.project}
        projectRoot={config.project.root}
        features={[]}
        adapters={[]}
        engineerRoles={[]}
        cronJobs={[]}
        activeRuns={[]}
        projects={[{ id: 'project-1', config, configPath: '/workspace/launch/.project-manager/config.json' }]}
        selectedProjectId="project-1"
        selectedDashboardProjectIds={['project-1']}
        dashboardProjectNames={[config.project.name]}
        dashboardProjects={[{ id: 'project-1', name: config.project.name }]}
        dashboardProjectConfigs={[{
          id: 'project-1',
          root: config.project.root,
          configPath: '/workspace/launch/.project-manager/config.json',
          progressSheets: config.progressSheets,
        }]}
        onSelectProject={() => {}}
        onToggleDashboardProject={() => {}}
        onAddProject={() => {}}
        onUpdateProject={() => {}}
        onRemoveProject={() => {}}
        onCronJobsChange={() => {}}
        onFeaturePatch={() => {}}
        onFeaturePromptSave={() => {}}
      />
    </I18nProvider>
  );
}

function renderDashboard(config: ProjectManagerConfig) {
  return render(dashboardNode(config));
}

describe('Project progress dashboard progress sheets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.location.hash = '';
  });

  it('renders the active sidecar sheet title and marketing columns without software deploy columns', async () => {
    const marketing = createProgressSheetConfigFromTemplate('marketing-campaign', {
      id: 'marketing-campaign',
      title: 'Marketing Campaign Progress',
      now,
    });
    marketing.rows = [
      {
        id: 'asset-1',
        title: 'Launch landing page',
        status: 'in-progress',
        progress: 35,
        owner: 'Maya',
        values: {
          campaignAsset: 'Launch landing page',
          channel: ['Email', 'Paid Social'],
          funnelStage: 'Awareness',
          approvalStatus: 'In Review',
          launchDate: '2026-07-01',
          kpi: 1200,
        },
        createdAt: now,
        updatedAt: now,
      },
    ];
    bridgeMock.readJsonFile.mockResolvedValue(marketing satisfies ProgressSheetConfig);

    renderDashboard(projectConfig([
      sheetRef(
        'marketing-campaign',
        'Marketing Campaign',
        '.project-manager/progress-sheets/marketing-campaign/config.json',
      ),
    ]));

    await waitFor(() => expect(screen.getByText('Marketing Campaign Progress')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /development progress sheet/i }));

    expect(await screen.findByText('Campaign Asset')).toBeInTheDocument();
    expect(screen.getByText('Funnel Stage')).toBeInTheDocument();
    expect(screen.getAllByText('Launch landing page').length).toBeGreaterThan(0);
    expect(screen.queryByText('Deploy Status')).not.toBeInTheDocument();
    expect(screen.queryByText('Release Channel')).not.toBeInTheDocument();
  });

  it('renders top-level progress row metadata in matching dynamic columns', async () => {
    const marketing = createProgressSheetConfigFromTemplate('marketing-campaign', {
      id: 'marketing-campaign',
      title: 'Marketing Campaign Progress',
      now,
    });
    marketing.columns = [
      ...marketing.columns,
      { id: 'status', label: 'Status', fieldType: 'select', order: 99, options: marketing.statusOptions },
      { id: 'owner', label: 'Owner', fieldType: 'person', order: 100 },
      { id: 'progress', label: 'Progress', fieldType: 'percent', order: 101 },
    ];
    marketing.rows = [
      {
        id: 'asset-1',
        title: 'Launch landing page',
        status: 'in-progress',
        progress: 35,
        owner: 'Maya',
        values: {
          campaignAsset: 'Launch landing page',
          channel: ['Email', 'Paid Social'],
          funnelStage: 'Awareness',
          approvalStatus: 'In Review',
          launchDate: '2026-07-01',
          kpi: 1200,
        },
        createdAt: now,
        updatedAt: now,
      },
    ];
    bridgeMock.readJsonFile.mockResolvedValue(marketing satisfies ProgressSheetConfig);

    renderDashboard(projectConfig([
      sheetRef(
        'marketing-campaign',
        'Marketing Campaign',
        '.project-manager/progress-sheets/marketing-campaign/config.json',
      ),
    ]));

    await userEvent.click(screen.getByRole('button', { name: /development progress sheet/i }));

    expect((await screen.findAllByText('In Progress')).length).toBeGreaterThan(0);
    expect(screen.getByText('Maya')).toBeInTheDocument();
    expect(screen.getByText('35%')).toBeInTheDocument();
  });

  it('shows a progress sheet loading state instead of the legacy editable table while sidecar read is pending', async () => {
    bridgeMock.readJsonFile.mockImplementation(() => new Promise(() => {}));

    renderDashboard(projectConfig([
      sheetRef(
        'marketing-campaign',
        'Marketing Campaign',
        '.project-manager/progress-sheets/marketing-campaign/config.json',
      ),
    ]));

    await userEvent.click(screen.getByRole('button', { name: /development progress sheet/i }));

    expect(await screen.findByText('Loading progress sheet config...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add row/i })).not.toBeInTheDocument();
  });

  it('falls back to the manifest sheet label when the sidecar config cannot be read', async () => {
    bridgeMock.readJsonFile.mockRejectedValue(new Error('missing sidecar'));

    renderDashboard(projectConfig([
      sheetRef(
        'marketing-campaign',
        'Marketing Campaign',
        '.project-manager/progress-sheets/marketing-campaign/config.json',
      ),
    ]));

    await waitFor(() => expect(screen.getAllByText('Marketing Campaign').length).toBeGreaterThan(0));
    expect(screen.getByText(/Could not load progress sheet config/)).toBeInTheDocument();
  });

  it('rejects unsafe progress sheet config paths before calling the bridge', async () => {
    renderDashboard(projectConfig([
      sheetRef(
        'marketing-campaign',
        'Marketing Campaign',
        '/tmp/marketing-campaign/config.json',
      ),
    ]));

    await userEvent.click(screen.getByRole('button', { name: /development progress sheet/i }));

    expect((await screen.findAllByText(/must be project-relative/)).length).toBeGreaterThan(0);
    expect(bridgeMock.readJsonFile).not.toHaveBeenCalled();
  });

  it('does not reload the sidecar on unrelated parent re-renders', async () => {
    const marketing = createProgressSheetConfigFromTemplate('marketing-campaign', {
      id: 'marketing-campaign',
      title: 'Marketing Campaign Progress',
      now,
    });
    bridgeMock.readJsonFile.mockResolvedValue(marketing);
    const config = projectConfig([
      sheetRef(
        'marketing-campaign',
        'Marketing Campaign',
        '.project-manager/progress-sheets/marketing-campaign/config.json',
      ),
    ]);

    const { rerender } = renderDashboard(config);

    await waitFor(() => expect(screen.getByText('Marketing Campaign Progress')).toBeInTheDocument());
    rerender(dashboardNode(config));
    await waitFor(() => expect(bridgeMock.readJsonFile).toHaveBeenCalledTimes(1));
  });

  it('scopes table preference storage by sheet id so dynamic column widths do not share arrays', async () => {
    const marketing = createProgressSheetConfigFromTemplate('marketing-campaign', {
      id: 'marketing-campaign',
      title: 'Marketing Campaign Progress',
      now,
    });
    window.localStorage.setItem(
      'projectManager.progressDashboard.sheet.marketing-campaign',
      JSON.stringify({ colWidths: [201, 202] }),
    );
    window.localStorage.setItem(
      'projectManager.progressDashboard.phase.development',
      JSON.stringify({ colWidths: [301, 302, 303, 304] }),
    );
    bridgeMock.readJsonFile.mockResolvedValue(marketing);

    renderDashboard(projectConfig([
      sheetRef(
        'marketing-campaign',
        'Marketing Campaign',
        '.project-manager/progress-sheets/marketing-campaign/config.json',
      ),
    ]));

    await waitFor(() => expect(screen.getByText('Marketing Campaign Progress')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /development progress sheet/i }));

    await waitFor(() => {
      const updated = JSON.parse(
        window.localStorage.getItem('projectManager.progressDashboard.sheet.marketing-campaign') ?? '{}',
      ) as { colWidths?: number[] };
      expect(updated.colWidths).toHaveLength(marketing.columns.length + 2);
    });
    expect(JSON.parse(window.localStorage.getItem('projectManager.progressDashboard.phase.development') ?? '{}')).toEqual({
      colWidths: [301, 302, 303, 304],
    });
  });
});
