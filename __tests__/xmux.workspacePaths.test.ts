import { describe, expect, it } from 'vitest';
import { deriveProjectWorkspacePath, validateWorkspaceFolderPath } from '../lib/xmux/workspacePaths';
import type { ProjectEntry, ProjectManagerConfig } from '../lib/types';

function project(root: string, configPath: string): ProjectEntry {
  const config: ProjectManagerConfig = {
    schemaVersion: 8,
    id: 'demo',
    createdAt: '2026-05-26T00:00:00.000Z',
    updatedAt: '2026-05-26T00:00:00.000Z',
    project: {
      name: 'Demo',
      root,
      defaultIDE: 'Cursor',
    },
    features: [],
    adapters: { ides: [], agents: [] },
    engineerRoles: [],
  };
  return { id: 'demo', config, configPath };
}

describe('xmux workspace path derivation', () => {
  it('uses a normal local project root for folder tabs', () => {
    const result = deriveProjectWorkspacePath(
      project('/repo/project-manager', '/unused/.project-manager/config.json'),
    );

    expect(result).toMatchObject({
      ok: true,
      cwd: '/repo/project-manager',
      source: 'project.root',
    });
  });

  it('normalizes a root accidentally stored as the canonical config path', () => {
    const result = deriveProjectWorkspacePath(
      project(
        '/repo/project-manager/.project-manager/config.json',
        '/unused/.project-manager/config.json',
      ),
    );

    expect(result).toMatchObject({
      ok: true,
      cwd: '/repo/project-manager',
      source: 'project.root',
    });
  });

  it('falls back to configPath when project.root is empty or relative', () => {
    const result = deriveProjectWorkspacePath(
      project('Project-Manager', '/repo/project-manager/.project-manager/config.json'),
    );

    expect(result).toMatchObject({
      ok: true,
      cwd: '/repo/project-manager',
      source: 'configPath',
    });
    expect(result.ok && result.warning).toContain('project.root');
  });

  it('keeps spaces and non-ASCII path segments intact', () => {
    const result = deriveProjectWorkspacePath(
      project('/repo/project-manager/internal-resources/test-fixtures/client-alpha', '/unused/.project-manager/config.json'),
    );

    expect(result).toMatchObject({
      ok: true,
      cwd: '/repo/project-manager/internal-resources/test-fixtures/client-alpha',
    });
  });

  it('rejects URLs and non-absolute folder roots before Tauri IPC', () => {
    expect(validateWorkspaceFolderPath('https://github.com/acme/repo')).toMatchObject({
      ok: false,
    });
    expect(validateWorkspaceFolderPath('relative/project')).toMatchObject({
      ok: false,
    });
  });
});
