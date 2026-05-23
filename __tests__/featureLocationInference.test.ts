import { describe, expect, it, vi } from 'vitest';
import { buildScanPrompt } from '../lib/scanner/shared';
import {
  inferLocatedSection,
  normalizeFeatureLocatedSection,
  normalizeFeaturesLocatedSection,
} from '../lib/storage/featureLocationInference';
import { applyScanConfigToProject } from '../lib/storage/importProjectEntry';
import type { Feature, ProjectEntry, ProjectManagerConfig } from '../lib/types';

const { writeConfigMock } = vi.hoisted(() => ({
  writeConfigMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/bridge', () => ({
  writeConfig: writeConfigMock,
}));

function feature(overrides: Partial<Feature> = {}): Feature {
  return {
    id: overrides.id ?? 'F01',
    name: overrides.name ?? 'Feature',
    category: overrides.category ?? 'Core',
    status: overrides.status ?? 'todo',
    progress: overrides.progress ?? 0,
    paths: overrides.paths ?? {},
    ...overrides,
  };
}

function config(features: Feature[]): ProjectManagerConfig {
  return {
    schemaVersion: 6,
    id: 'cfg',
    project: {
      name: 'Demo',
      root: '/tmp/demo',
      defaultIDE: 'Cursor',
    },
    features,
    adapters: { ides: [], agents: [] },
  };
}

describe('feature location inference', () => {
  it('preserves an existing locatedSection', () => {
    const f = feature({ locatedSection: 'dashboard/core' });
    expect(inferLocatedSection(f)).toBe('dashboard/core');
    expect(normalizeFeatureLocatedSection(f).locatedSection).toBe('dashboard/core');
  });

  it('infers from route-like implementation path', () => {
    const f = feature({
      paths: { implementation: 'app/project-progress-dashboard/page.tsx' },
    });
    expect(inferLocatedSection(f)).toBe('project-progress-dashboard');
  });

  it('infers from module path under components', () => {
    const f = feature({
      paths: { implementation: 'components/table/TaskDispatchModal.tsx' },
    });
    expect(inferLocatedSection(f)).toBe('table');
  });

  it('falls back to spec path when implementation is missing', () => {
    const f = feature({
      paths: { spec: 'docs/features/f21-located-section.md' },
    });
    expect(inferLocatedSection(f)).toBe('features');
  });

  it('falls back to test path when only tests exist', () => {
    const f = feature({
      paths: { test: '__tests__/progressDashboard.editing.test.tsx' },
    });
    expect(inferLocatedSection(f)).toBe('progressDashboard-editing-test');
  });

  it('falls back to category when no paths are present', () => {
    const f = feature({ category: 'Frontend/UI', paths: {} });
    expect(inferLocatedSection(f)).toBe('Frontend/UI');
  });

  it('falls back to feature name when paths and category are empty', () => {
    const f = feature({ name: 'Dispatch Controls', category: '', paths: {} });
    expect(inferLocatedSection(f)).toBe('Dispatch Controls');
  });

  it('returns undefined only when no signal exists', () => {
    const f = feature({ name: '', category: '', paths: {} });
    expect(inferLocatedSection(f)).toBeUndefined();
  });

  it('normalizes collections and stays idempotent', () => {
    const input = [
      feature({ id: 'A', locatedSection: 'already/set' }),
      feature({ id: 'B', paths: { implementation: 'lib/storage/migrate.ts' } }),
    ];
    const once = normalizeFeaturesLocatedSection(input);
    const twice = normalizeFeaturesLocatedSection(once);
    expect(once[0].locatedSection).toBe('already/set');
    expect(once[1].locatedSection).toBe('storage');
    expect(twice).toEqual(once);
  });
});

describe('scan initialization integration', () => {
  it('applyScanConfigToProject writes inferred locatedSection values', async () => {
    writeConfigMock.mockClear();
    const project: ProjectEntry = {
      id: 'proj-1',
      configPath: '/tmp/demo/.project-manager/config.json',
      config: config([]),
    };
    const scanned = config([
      feature({
        id: 'F10',
        paths: { implementation: 'app/ui/MainClient.tsx' },
      }),
    ]);

    const next = await applyScanConfigToProject(project, scanned);

    expect(next.config.features[0].locatedSection).toBe('ui');
    expect(writeConfigMock).toHaveBeenCalledTimes(1);
  });

  it('applyScanConfigToProject does not override explicit locatedSection', async () => {
    writeConfigMock.mockClear();
    const project: ProjectEntry = {
      id: 'proj-2',
      configPath: '/tmp/demo/.project-manager/config.json',
      config: config([]),
    };
    const scanned = config([
      feature({
        id: 'F11',
        locatedSection: 'custom/section',
        paths: { implementation: 'app/ui/views/ProjectsView.tsx' },
      }),
    ]);

    const next = await applyScanConfigToProject(project, scanned);
    expect(next.config.features[0].locatedSection).toBe('custom/section');
  });
});

describe('scan prompt contract', () => {
  it('includes locatedSection in expected feature schema', () => {
    const prompt = buildScanPrompt({
      source: '/tmp/demo',
      projectName: 'Demo',
      directoryTree: 'app/\nlib/\n',
      keyFiles: {},
      detectedIDEs: ['Cursor'],
      detectedAgents: ['Codex CLI'],
    });
    expect(prompt).toContain('"locatedSection"');
    expect(prompt).toContain('route, module, workflow area, or subsystem');
  });
});

