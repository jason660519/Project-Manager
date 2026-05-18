import { describe, expect, it } from 'vitest';
import { enrichConfigFromBundledSample } from '../lib/storage/bundledSamples';
import { mergeFeaturesById } from '../lib/storage/mergeFeatures';
import { mergeProjectConfigFromDisk } from '../lib/storage/mergeProjectFromDisk';
import type { Feature, ProjectManagerConfig } from '../lib/types';

const localFeature: Feature = {
  id: 'F01',
  name: 'Sidebar',
  category: 'UI',
  status: 'done',
  progress: 100,
  paths: { spec: 'docs/features/F01.md' },
};

const localConfig: ProjectManagerConfig = {
  schemaVersion: 4,
  id: 'test-project-id',
  project: { name: 'Project Manager', root: '/Volumes/KLEVV-4T-1/Project-Manager', defaultIDE: 'Cursor' },
  features: [localFeature],
  adapters: { ides: [], agents: [] },
};

describe('mergeFeaturesById', () => {
  it('keeps local features when remote list is an empty scaffold', () => {
    expect(mergeFeaturesById([], [localFeature])).toEqual([localFeature]);
  });
});

describe('enrichConfigFromBundledSample', () => {
  it('fills features for the Project Manager sample path', () => {
    const empty: ProjectManagerConfig = {
      ...localConfig,
      features: [],
    };
    const enriched = enrichConfigFromBundledSample(
      empty,
      '/Volumes/KLEVV-4T-1/Project-Manager/.project-manager.json',
    );
    expect(enriched.features.length).toBeGreaterThan(0);
  });
});

describe('mergeProjectConfigFromDisk', () => {
  it('preserves local features when disk has none', () => {
    const disk = { ...localConfig, features: [] };
    const merged = mergeProjectConfigFromDisk(
      localConfig,
      disk,
      '/some/other/path/.project-manager.json',
    );
    expect(merged.features).toEqual([localFeature]);
  });

  it('uses bundled sample when both disk and local are empty for PM path', () => {
    const disk = { ...localConfig, features: [] };
    const merged = mergeProjectConfigFromDisk(
      { ...localConfig, features: [] },
      disk,
      '/Volumes/KLEVV-4T-1/Project-Manager/.project-manager.json',
    );
    expect(merged.features.length).toBeGreaterThan(0);
  });
});
