import { describe, expect, it } from 'vitest';
import {
  PROJECT_SCOPED_AUTOSTART_PLUGIN_IDS,
  projectScopedBin,
  resolveProjectManagerRepoRoot,
} from '../lib/project-manager-root';
import {
  buildPluginCatalogMirror,
  parsePluginCatalogMirror,
} from '../lib/storage/plugin-catalog-mirror';
import {
  loadPluginCatalog,
  togglePluginAutostart,
  togglePluginEnabled,
} from '../lib/storage/plugins';
import type { PluginCatalog } from '../lib/types/plugins';

describe('project manager root helpers', () => {
  it('resolves repo root from sample config when no override', () => {
    const root = resolveProjectManagerRepoRoot();
    expect(root.length).toBeGreaterThan(0);
    expect(root).toContain('Project-Manager');
  });

  it('builds project-scoped bin paths without hardcoded machine paths', () => {
    expect(projectScopedBin('openclaw', '/tmp/pm')).toBe('/tmp/pm/.project-manager/bin/openclaw');
    expect(projectScopedBin('hermes', '')).toBe('.project-manager/bin/hermes');
  });

  it('lists sidecar plugin ids for autostart UI', () => {
    expect([...PROJECT_SCOPED_AUTOSTART_PLUGIN_IDS].sort()).toEqual(['hermes-agent', 'openclaw']);
  });
});

describe('plugin catalog mirror', () => {
  it('mirrors default sidecars as disabled with autostart off', () => {
    const catalog = loadPluginCatalog();
    const mirror = buildPluginCatalogMirror(catalog);
    expect(mirror.schemaVersion).toBe(1);
    expect(mirror.plugins.openclaw).toEqual({
      enabled: false,
      autostart: false,
      kind: 'cli',
    });
    expect(mirror.plugins['hermes-agent']).toEqual({
      enabled: false,
      autostart: false,
      kind: 'cli',
    });
  });

  it('reflects enable + autostart toggles', () => {
    let catalog = loadPluginCatalog();
    catalog = togglePluginEnabled(catalog, 'openclaw');
    catalog = togglePluginAutostart(catalog, 'openclaw');
    const mirror = buildPluginCatalogMirror(catalog);
    expect(mirror.plugins.openclaw).toEqual({
      enabled: true,
      autostart: true,
      kind: 'cli',
    });
  });

  it('parses valid mirror JSON', () => {
    const parsed = parsePluginCatalogMirror({
      schemaVersion: 1,
      updatedAt: '2026-05-30T00:00:00.000Z',
      plugins: {
        openclaw: { enabled: true, autostart: false, kind: 'cli' },
      },
    });
    expect(parsed?.plugins.openclaw.enabled).toBe(true);
  });

  it('rejects malformed mirror JSON', () => {
    expect(parsePluginCatalogMirror(null)).toBeNull();
    expect(parsePluginCatalogMirror({ schemaVersion: 2 })).toBeNull();
  });

  it('leaves plugins unchanged when toggling autostart for unknown id', () => {
    const catalog: PluginCatalog = { schemaVersion: 2, plugins: [] };
    expect(togglePluginAutostart(catalog, 'missing').plugins).toEqual([]);
  });

  it('uses relative commands for built-in sidecar CLIs', () => {
    const catalog = loadPluginCatalog();
    const openclaw = catalog.plugins.find((p) => p.id === 'openclaw');
    const hermes = catalog.plugins.find((p) => p.id === 'hermes-agent');
    expect(openclaw && 'command' in openclaw ? openclaw.command : '').toBe('.project-manager/bin/openclaw');
    expect(hermes && 'command' in hermes ? hermes.command : '').toBe('.project-manager/bin/hermes');
    expect(openclaw && 'command' in openclaw ? openclaw.command : '').not.toContain('/Volumes/');
  });
});
