import { DEFAULT_ENGINEER_ROLES } from '../defaults/engineerRoles';
import type { EngineerRole, ProjectManagerConfig } from '../types';

/**
 * Merge stored roles with defaults by stable `id`.
 * Stored/custom entries win; missing default ids are appended in default order.
 */
export function mergeEngineerRolesById(
  stored: EngineerRole[] | undefined,
  defaults: EngineerRole[] = DEFAULT_ENGINEER_ROLES,
): EngineerRole[] {
  const existing = Array.isArray(stored) ? stored : [];
  const seen = new Set(existing.map((r) => r.id));
  const merged = [...existing];
  for (const role of defaults) {
    if (!seen.has(role.id)) {
      merged.push(role);
    }
  }
  return merged;
}

/** Ensure config carries the full default role set (disk + bundled samples). */
export function ensureEngineerRoles(config: ProjectManagerConfig): ProjectManagerConfig {
  const merged = mergeEngineerRolesById(config.engineerRoles);
  if (merged.length === (config.engineerRoles?.length ?? 0) && config.engineerRoles) {
    return config;
  }
  return { ...config, engineerRoles: merged };
}
