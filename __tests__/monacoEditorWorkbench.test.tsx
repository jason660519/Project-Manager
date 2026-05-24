import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  MonacoEditorWorkbench,
  buildMonacoWorkbenchFiles,
  detectMonacoWorkbenchLanguage,
} from '../app/ui/views/MonacoEditorWorkbench';
import type { ProjectEntry, ProjectManagerConfig } from '../lib/types';

vi.mock('../components/CodeEditor', () => ({
  CodeEditor: ({
    files,
    onTabClose,
  }: {
    files: Array<{ path: string; label?: string }>;
    onTabClose?: (path: string) => void;
  }) => (
    <div data-testid="mock-code-editor">
      {files.map((file) => (
        <button key={file.path} type="button" onClick={() => onTabClose?.(file.path)}>
          {file.label ?? file.path}
        </button>
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

describe('MonacoEditorWorkbench', () => {
  it('builds editable feature artifacts and detects languages', () => {
    const files = buildMonacoWorkbenchFiles(alpha);

    expect(files.map((file) => file.relativePath)).toEqual(
      expect.arrayContaining([
        '.project-manager/features/F01/README.md',
        '.project-manager/features/F01/feature-spec.md',
        '.project-manager/features/F01/tdd-spec.md',
        '.project-manager/features/F01/dev-log.md',
        'src/alpha.ts',
        '__tests__/F01.test.tsx',
      ]),
    );
    expect(detectMonacoWorkbenchLanguage('src/component.tsx')).toBe('typescript');
    expect(detectMonacoWorkbenchLanguage('README.md')).toBe('markdown');
  });

  it('renders an empty state when no project is loaded', () => {
    render(
      <MonacoEditorWorkbench
        projects={[]}
        selectedDashboardProjectIds={[]}
      />,
    );

    expect(screen.getByText('No projects loaded.')).toBeInTheDocument();
  });

  it('opens selected files in the Monaco editor area', () => {
    render(
      <MonacoEditorWorkbench
        projects={[alpha]}
        selectedDashboardProjectIds={['alpha']}
        selectedProjectId="alpha"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /src\/alpha\.ts/i }));

    expect(screen.getByTestId('mock-code-editor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /F01 Implementation/i })).toBeInTheDocument();
  });

  it('switches between Dashboard-selected project sheets', () => {
    render(
      <MonacoEditorWorkbench
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

  it('filters mapped files by feature id', () => {
    render(
      <MonacoEditorWorkbench
        projects={[alpha]}
        selectedDashboardProjectIds={['alpha']}
        selectedProjectId="alpha"
      />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: /Feature filter/i }), {
      target: { value: 'F01' },
    });

    expect(screen.getByText('src/alpha.ts')).toBeInTheDocument();
    expect(screen.getAllByText('F01').length).toBeGreaterThan(0);
  });
});
