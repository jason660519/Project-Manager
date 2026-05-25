import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IdeBridgeView,
  buildIdeBridgeArtifacts,
  buildIdeBridgeTargets,
} from '../app/ui/views/IdeBridgeView';
import type { ProjectEntry, ProjectManagerConfig } from '../lib/types';

const bridgeMocks = vi.hoisted(() => ({
  openInEditor: vi.fn(),
  resolveInstallPath: vi.fn(),
}));

vi.mock('../lib/bridge', () => ({
  openInEditor: bridgeMocks.openInEditor,
  resolveInstallPath: bridgeMocks.resolveInstallPath,
}));

function projectEntry(
  id: string,
  name: string,
  root: string,
  featureId: string,
  filePath: string,
  status: ProjectManagerConfig['features'][number]['status'] = 'in_progress',
): ProjectEntry {
  const config: ProjectManagerConfig = {
    schemaVersion: 6,
    id,
    project: {
      name,
      root,
      defaultIDE: 'Cursor',
    },
    features: [
      {
        id: featureId,
        name: `${name} Feature`,
        category: 'Core',
        status,
        progress: 30,
        readmePath: `.project-manager/features/${featureId}/README.md`,
        paths: {
          spec: `.project-manager/features/${featureId}/feature-spec.md`,
          tdd: `.project-manager/features/${featureId}/tdd-spec.md`,
          implementation: filePath,
          test: `__tests__/${featureId}.test.tsx`,
          developmentLogSummaryFolder: `.project-manager/features/${featureId}/`,
        },
      },
    ],
    adapters: {
      ides: [],
      agents: [],
      apps: [],
    },
  };

  return {
    id,
    config,
    configPath: `${root}/.project-manager/config.json`,
  };
}

const alpha = projectEntry('alpha', 'Alpha Project', '/projects/alpha', 'F01', 'src/alpha.ts');
const beta = projectEntry('beta', 'Beta Project', '/projects/beta', 'F02', 'src/beta.tsx');

describe('IdeBridgeView', () => {
  beforeEach(() => {
    bridgeMocks.openInEditor.mockReset();
    bridgeMocks.openInEditor.mockResolvedValue(undefined);
    bridgeMocks.resolveInstallPath.mockReset();
    bridgeMocks.resolveInstallPath.mockResolvedValue({ commandPath: null, appBundlePath: null });
  });

  it('builds IDE bridge launch artifacts from project config and feature files', () => {
    const artifacts = buildIdeBridgeArtifacts(alpha);

    expect(artifacts.map((artifact) => artifact.relativePath)).toEqual(
      expect.arrayContaining([
        '.project-manager/config.json',
        '.project-manager/features/F01/README.md',
        '.project-manager/features/F01/feature-spec.md',
        '.project-manager/features/F01/tdd-spec.md',
        '.project-manager/features/F01/dev-log.md',
        'src/alpha.ts',
        '__tests__/F01.test.tsx',
      ]),
    );
  });

  it('builds IDE targets from project adapters and default IDE fallback', () => {
    const project = projectEntry('ide', 'IDE Project', '/projects/ide', 'F04', 'src/ide.ts');
    project.config.project.defaultIDE = 'VSCode';
    project.config.adapters.ides = [
      {
        id: 'cursor-custom',
        name: 'Cursor Custom',
        type: 'ide',
        command: '/usr/local/bin/cursor',
      },
    ];

    const targets = buildIdeBridgeTargets(project);

    expect(targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Cursor Custom',
          command: '/usr/local/bin/cursor',
          source: 'adapter',
        }),
        expect.objectContaining({
          label: 'Visual Studio Code',
          command: 'code',
          preferred: true,
        }),
      ]),
    );
  });

  it('renders only the commercial IDE Bridge surface, not fake VS Code workbench panels', () => {
    render(
      <IdeBridgeView
        projects={[alpha]}
        selectedDashboardProjectIds={['alpha']}
        selectedProjectId="alpha"
      />,
    );

    expect(screen.getByRole('navigation', { name: /IDE targets/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cursor' })).toBeInTheDocument();
    expect(screen.getByText('Bridge contract')).toBeInTheDocument();
    expect(screen.getByText(/No bundled or embedded third-party IDE runtime/i)).toBeInTheDocument();
    expect(screen.getByText('Open targets')).toBeInTheDocument();
    expect(screen.queryByText('Open Editors')).not.toBeInTheDocument();
    expect(screen.queryByText('Quick Open')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Explorer$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Problems$/i })).not.toBeInTheDocument();
  });

  it('switches project sheets from the bottom tabs', () => {
    render(
      <IdeBridgeView
        projects={[alpha, beta]}
        selectedDashboardProjectIds={['alpha', 'beta']}
        selectedProjectId="alpha"
      />,
    );

    expect(screen.getByText('src/alpha.ts')).toBeInTheDocument();
    expect(screen.queryByText('src/beta.tsx')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Beta Project/i }));

    expect(screen.getByText('src/beta.tsx')).toBeInTheDocument();
    expect(screen.queryByText('src/alpha.ts')).not.toBeInTheDocument();
  });

  it('opens the active project workspace in the selected IDE', async () => {
    render(
      <IdeBridgeView
        projects={[alpha]}
        selectedDashboardProjectIds={['alpha']}
        selectedProjectId="alpha"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Open Workspace/i }));

    await waitFor(() => {
      expect(bridgeMocks.openInEditor).toHaveBeenCalledWith({
        editor: 'cursor',
        path: '/projects/alpha',
      });
    });
    expect(screen.getByText(/Requested Cursor to open workspace Alpha Project/i)).toBeInTheDocument();
  });

  it('opens the project config in the selected IDE', async () => {
    render(
      <IdeBridgeView
        projects={[alpha]}
        selectedDashboardProjectIds={['alpha']}
        selectedProjectId="alpha"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Open Config/i }));

    await waitFor(() => {
      expect(bridgeMocks.openInEditor).toHaveBeenCalledWith({
        editor: 'cursor',
        path: '/projects/alpha/.project-manager/config.json',
      });
    });
  });

  it('opens the selected artifact in the selected IDE', async () => {
    render(
      <IdeBridgeView
        projects={[alpha]}
        selectedDashboardProjectIds={['alpha']}
        selectedProjectId="alpha"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /src\/alpha\.ts/i }));
    fireEvent.click(screen.getByRole('button', { name: /Open Selected File/i }));

    await waitFor(() => {
      expect(bridgeMocks.openInEditor).toHaveBeenCalledWith({
        editor: 'cursor',
        path: '/projects/alpha/src/alpha.ts',
      });
    });
  });

  it('changes the selected IDE from the left toolbar', async () => {
    render(
      <IdeBridgeView
        projects={[alpha]}
        selectedDashboardProjectIds={['alpha']}
        selectedProjectId="alpha"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Visual Studio Code' }));
    fireEvent.click(screen.getByRole('button', { name: /Open Workspace/i }));

    await waitFor(() => {
      expect(bridgeMocks.openInEditor).toHaveBeenCalledWith({
        editor: 'code',
        path: '/projects/alpha',
      });
    });
  });

  it('renders an empty state when no project is loaded', () => {
    render(
      <IdeBridgeView
        projects={[]}
        selectedDashboardProjectIds={[]}
      />,
    );

    expect(screen.getByText('No projects loaded.')).toBeInTheDocument();
  });
});
