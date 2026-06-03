import type { ProjectEntry } from '../types';

/** Metric copy for Company Standards — mirrors Project Dashboard multi-select scope. */
export function buildGovernedAppsMetric(dashboardScopeProjects: readonly ProjectEntry[]): {
  value: string;
  detail: string;
} {
  const count = dashboardScopeProjects.length;
  if (count === 0) {
    return {
      value: '0',
      detail: 'No projects in dashboard scope — enable Include on the Projects sheet',
    };
  }
  const names = dashboardScopeProjects.map((p) => p.config.project.name);
  return {
    value: String(count),
    detail: names.join(', '),
  };
}
