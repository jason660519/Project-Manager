export const PM_ACTIVE_WORKSPACE_STORAGE_KEY = 'pm.activeWorkspaceId';

export function readStoredActiveWorkspaceId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const value = window.localStorage.getItem(PM_ACTIVE_WORKSPACE_STORAGE_KEY);
    return typeof value === 'string' && value.trim() ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredActiveWorkspaceId(workspaceId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(PM_ACTIVE_WORKSPACE_STORAGE_KEY, workspaceId);
  } catch {
    // Storage failures should not crash session resolution; UI can retry on select.
  }
}

export function clearStoredActiveWorkspaceId(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(PM_ACTIVE_WORKSPACE_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}
