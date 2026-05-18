import { describe, expect, it } from 'vitest';
import { DEFAULT_ENGINEER_ROLES } from '../lib/defaults/engineerRoles';
import { ensureEngineerRoles, mergeEngineerRolesById } from '../lib/storage/mergeEngineerRoles';
import type { ProjectManagerConfig } from '../lib/types';

describe('mergeEngineerRolesById', () => {
  it('returns all defaults when stored is empty', () => {
    expect(mergeEngineerRolesById([])).toHaveLength(DEFAULT_ENGINEER_ROLES.length);
    expect(mergeEngineerRolesById(undefined)).toHaveLength(DEFAULT_ENGINEER_ROLES.length);
  });

  it('appends only missing default roles', () => {
    const stored = DEFAULT_ENGINEER_ROLES.filter((r) => r.id !== 'role-devex');
    const merged = mergeEngineerRolesById(stored);
    expect(merged).toHaveLength(DEFAULT_ENGINEER_ROLES.length);
    expect(merged.some((r) => r.id === 'role-devex')).toBe(true);
  });

  it('keeps custom stored roles over defaults with the same id', () => {
    const custom = { ...DEFAULT_ENGINEER_ROLES[0], name: 'Custom Frontend' };
    const merged = mergeEngineerRolesById([custom]);
    expect(merged.find((r) => r.id === 'role-frontend')?.name).toBe('Custom Frontend');
  });
});

describe('ensureEngineerRoles', () => {
  it('adds engineerRoles when config omits them', () => {
    const cfg = {
      schemaVersion: 3,
      id: 'test',
      project: { name: 'x', root: '/x', defaultIDE: 'Cursor' },
      features: [],
      adapters: { ides: [], agents: [] },
    } as ProjectManagerConfig;
    const next = ensureEngineerRoles(cfg);
    expect(next.engineerRoles).toHaveLength(DEFAULT_ENGINEER_ROLES.length);
  });
});
