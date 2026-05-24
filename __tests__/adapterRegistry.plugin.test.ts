import { describe, expect, it } from 'vitest';
import { createRuntimeAdapter, createRuntimeAdapterFromConfig, listAdapters } from '../lib/adapters/registry';
import { KEY_SHARED_PLUGINS } from '../lib/storage/keys';
import { loadPluginCatalog } from '../lib/storage/plugins';
import { CURRENT_SCHEMA_VERSION } from '../lib/storage/migrate';
import type { Feature, ProjectManagerConfig } from '../lib/types';
import type { PluginCatalog } from '../lib/types/plugins';

const feature: Feature = {
  id: 'feat-001',
  name: 'Plugin dispatch',
  category: 'automation',
  status: 'todo',
  progress: 0,
  paths: {},
};

const config: ProjectManagerConfig = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: 'project-001',
  createdAt: '2026-05-18T00:00:00.000Z',
  updatedAt: '2026-05-18T00:00:00.000Z',
  project: {
    name: 'Project Manager',
    root: '/tmp/project-manager',
    defaultIDE: 'Cursor',
  },
  features: [feature],
  adapters: {
    ides: [],
    agents: [],
  },
  engineerRoles: [],
};

function saveCatalog(catalog: PluginCatalog) {
  window.localStorage.setItem(KEY_SHARED_PLUGINS, JSON.stringify(catalog));
}

describe('adapter registry plugin agents', () => {
  it('exposes enabled Hermes/OpenClaw CLI plugins as runtime agent adapters', async () => {
    saveCatalog({
      schemaVersion: 2,
      plugins: [
        {
          id: 'openclaw',
          kind: 'cli',
          name: 'OpenClaw',
          enabled: true,
          installedAt: '2026-05-18T00:00:00.000Z',
          command: '/tmp/project-manager/.project-manager/bin/openclaw',
          argsTemplate: ['agent', '--message', '{prompt}', '--cwd', '{root}', '--feature', '{featureId}'],
        },
      ],
    });

    expect(listAdapters(config).map((adapter) => adapter.id)).toContain('openclaw');

    const adapter = createRuntimeAdapter(config, 'openclaw');
    expect(adapter).not.toBeNull();

    const result = await adapter!.execute({
      feature,
      prompt: 'Implement the plugin flow',
      projectRoot: '/tmp/project-manager',
    });

    expect(result.success).toBe(true);
    expect(result.command).toBe('/tmp/project-manager/.project-manager/bin/openclaw');
    expect(result.args).toEqual([
      'agent',
      '--message',
      'Implement the plugin flow',
      '--cwd',
      '/tmp/project-manager',
      '--feature',
      'feat-001',
    ]);
  });

  it('keeps disabled CLI plugins out of the runtime adapter registry', () => {
    saveCatalog({
      schemaVersion: 2,
      plugins: [
        {
          id: 'hermes-agent',
          kind: 'cli',
          name: 'Hermes Agent',
          enabled: false,
          installedAt: '2026-05-18T00:00:00.000Z',
          command: '/tmp/project-manager/.project-manager/bin/hermes',
          argsTemplate: ['chat', '-q', '{prompt}'],
        },
      ],
    });

    expect(listAdapters(config).map((adapter) => adapter.id)).not.toContain('hermes-agent');
    expect(createRuntimeAdapter(config, 'hermes-agent')).toBeNull();
  });

  it('upgrades existing plugin catalogs with the built-in Monaco frontend plugin', () => {
    saveCatalog({
      schemaVersion: 2,
      plugins: [
        {
          id: 'openclaw',
          kind: 'cli',
          name: 'OpenClaw CLI',
          enabled: false,
          installedAt: '2026-05-18T00:00:00.000Z',
          command: '/tmp/project-manager/.project-manager/bin/openclaw',
          argsTemplate: ['agent', '--message', '{prompt}'],
        },
      ],
    });

    const catalog = loadPluginCatalog();
    const monaco = catalog.plugins.find((plugin) => plugin.id === 'monaco-editor');

    expect(monaco).toMatchObject({
      id: 'monaco-editor',
      kind: 'frontend',
      packageName: '@monaco-editor/react',
      implementationPath: 'app/ui/views/MonacoEditorWorkbench.tsx',
    });
  });


  it('preserves IDE adapter fallback to the project root when a feature has no file path', async () => {
    const adapter = createRuntimeAdapterFromConfig({
      id: 'cursor',
      name: 'Cursor',
      type: 'ide',
      command: 'cursor',
    });

    const result = await adapter.execute({
      feature,
      projectRoot: '/tmp/project-manager',
    });

    expect(result.success).toBe(true);
    expect(result.command).toBe('cursor');
    expect(result.args).toEqual(['/tmp/project-manager']);
  });
});
