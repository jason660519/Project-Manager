import type { ProjectEntry } from './types';

export type ProjectSetupStatus = 'ready' | 'scaffold' | 'needs_scan';

/** Derive setup status for UI badges and action visibility. */
export function getProjectSetupStatus(entry: ProjectEntry): ProjectSetupStatus {
  if (entry.configMissing) return 'needs_scan';
  if (entry.config.features.length === 0) return 'scaffold';
  return 'ready';
}

export function projectNeedsScan(entry: ProjectEntry): boolean {
  const status = getProjectSetupStatus(entry);
  return status === 'needs_scan' || status === 'scaffold';
}

export function setupStatusLabel(status: ProjectSetupStatus): string {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'scaffold':
      return 'Empty scaffold';
    case 'needs_scan':
      return 'Needs setup';
  }
}
