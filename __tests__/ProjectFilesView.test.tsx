import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectFilesView } from '../app/ui/views/ProjectFilesView';
import type { ProjectEntry, ProjectManagerConfig } from '../lib/types';

vi.mock('../components/CodeEditor', () => ({
  CodeEditor: ({ files }: { files: Array<{ path: string; label?: string }> }) => (
    <div data-testid="mock-code-editor">
      {files.map((file) => (
        <span key={file.path}>{file.label ?? file.path}</span>
      ))}
    </div>
  ),
}));

function projectEntry(id: string, name: string, root: string, featureId: string, filePath: string): ProjectEntry {
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
        status: 'in_progress',
        progress: 30,
        readmePath: `.project-manager/features/${featureId}/README.md`,
        paths: {
          spec: `.project-manager/features/${featureId}/feature-spec.md`,
          implementation: filePath,
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
const beta = projectEntry('beta', 'Beta Project', '/projects/beta', 'F02', 'src/beta.ts');

describe('ProjectFilesView', () => {
  it('renders one project sheet per Dashboard-selected project', () => {
    render(
      <ProjectFilesView
        projects={[alpha, beta]}
        selectedDashboardProjectIds={['alpha', 'beta']}
        selectedProjectId="alpha"
      />,
    );

    expect(screen.getByRole('button', { name: /Alpha Project/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Beta Project/i })).toBeInTheDocument();
    expect(screen.getByText('src/alpha.ts')).toBeInTheDocument();
    expect(screen.queryByText('src/beta.ts')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Beta Project/i }));

    expect(screen.getByText('src/beta.ts')).toBeInTheDocument();
    expect(screen.queryByText('src/alpha.ts')).not.toBeInTheDocument();
  });

  it('falls back to the selected project when Dashboard scope is empty', () => {
    render(
      <ProjectFilesView
        projects={[alpha, beta]}
        selectedDashboardProjectIds={[]}
        selectedProjectId="beta"
      />,
    );

    expect(screen.queryByRole('button', { name: /Alpha Project/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Beta Project/i })).toBeInTheDocument();
    expect(screen.getByText('src/beta.ts')).toBeInTheDocument();
  });

  it('filters the active sheet table by feature', () => {
    render(
      <ProjectFilesView
        projects={[alpha]}
        selectedDashboardProjectIds={['alpha']}
        selectedProjectId="alpha"
      />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: /Feature filter/i }), { target: { value: 'F01' } });

    expect(screen.getByText('src/alpha.ts')).toBeInTheDocument();
    expect(screen.getAllByText('F01').length).toBeGreaterThan(0);
  });
});
