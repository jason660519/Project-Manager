import { describe, expect, it } from 'vitest';
import { buildGovernedAppsMetric } from '../lib/companyStandards/governedProjectsMetric';
import type { ProjectEntry } from '../lib/types';

function project(id: string, name: string): ProjectEntry {
  return {
    id,
    configPath: `/tmp/${id}/.project-manager/config.json`,
    config: {
      schemaVersion: 6,
      project: { name, root: `/tmp/${id}` },
      features: [],
    } as unknown as ProjectEntry['config'],
  };
}

describe('buildGovernedAppsMetric', () => {
  it('returns zero state when dashboard scope is empty', () => {
    const metric = buildGovernedAppsMetric([]);
    expect(metric.value).toBe('0');
    expect(metric.detail).toMatch(/Include/i);
  });

  it('reflects selected dashboard project names and count', () => {
    const metric = buildGovernedAppsMetric([
      project('alpha', 'Alpha App'),
      project('beta', 'Beta Suite'),
    ]);
    expect(metric.value).toBe('2');
    expect(metric.detail).toBe('Alpha App, Beta Suite');
  });
});
