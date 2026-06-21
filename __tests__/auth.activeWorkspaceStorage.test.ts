import { describe, expect, it, vi } from 'vitest';
import {
  PM_ACTIVE_WORKSPACE_STORAGE_KEY,
  readStoredActiveWorkspaceId,
  writeStoredActiveWorkspaceId,
} from '../lib/auth/activeWorkspaceStorage';

describe('active workspace storage', () => {
  it('reads and writes the active workspace id from localStorage', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    });

    expect(readStoredActiveWorkspaceId()).toBeNull();
    writeStoredActiveWorkspaceId('workspace-1');
    expect(readStoredActiveWorkspaceId()).toBe('workspace-1');
    expect(storage.get(PM_ACTIVE_WORKSPACE_STORAGE_KEY)).toBe('workspace-1');
  });
});
