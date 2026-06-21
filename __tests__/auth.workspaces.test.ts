import { describe, expect, it, vi } from 'vitest';
import { createWorkspace, type WorkspaceCreateClient } from '../lib/auth/workspaces';

describe('workspace create helper', () => {
  it('creates a workspace through the audited RPC abstraction', async () => {
    const client = {
      rpc: vi.fn(async () => ({
        data: {
          id: 'workspace-1',
          name: 'Alpha Team',
          created_at: '2026-06-21T12:00:00.000Z',
        },
        error: null,
      })),
    } as unknown as WorkspaceCreateClient;

    await expect(createWorkspace('Alpha Team', client)).resolves.toEqual({
      workspace: {
        id: 'workspace-1',
        name: 'Alpha Team',
        createdAt: '2026-06-21T12:00:00.000Z',
      },
      error: null,
    });

    expect(client.rpc).toHaveBeenCalledWith('pm_create_workspace', {
      p_name: 'Alpha Team',
    });
  });

  it('returns a visible error when the workspace name is empty', async () => {
    const client = {
      rpc: vi.fn(),
    } as unknown as WorkspaceCreateClient;

    await expect(createWorkspace('   ', client)).resolves.toEqual({
      workspace: null,
      error: 'Workspace name is required.',
    });

    expect(client.rpc).not.toHaveBeenCalled();
  });
});
