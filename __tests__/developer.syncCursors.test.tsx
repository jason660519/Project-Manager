import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeveloperSyncCursorsPanel } from '../app/developer/DeveloperSyncCursorsPanel';

vi.mock('../lib/auth/syncCursors', () => ({
  formatSyncResourceTypeLabel: (value: string) => value,
  formatSyncStatusLabel: (value: string) => value,
  listSyncCursors: vi.fn(),
}));

import { listSyncCursors } from '../lib/auth/syncCursors';

describe('DeveloperSyncCursorsPanel', () => {
  it('loads and renders sync cursors for developer roles', async () => {
    vi.mocked(listSyncCursors).mockResolvedValue({
      cursors: [
        {
          id: 'cursor-1',
          workspaceId: 'workspace-1',
          projectId: 'project-1',
          projectName: 'Alpha Project',
          resourceType: 'project_config',
          resourceKey: 'alpha-config',
          localRevision: 'abc123',
          cloudRevision: 'def456',
          lastSyncedAt: '2026-06-21T12:00:00.000Z',
          syncStatus: 'idle',
          updatedAt: '2026-06-21T12:05:00.000Z',
        },
      ],
      error: null,
    });

    render(<DeveloperSyncCursorsPanel workspaceRole="developer" workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText('alpha-config')).toBeInTheDocument();
    });

    expect(screen.getByText(/Project: Alpha Project/)).toBeInTheDocument();
    expect(screen.getByText(/Local revision: abc123/)).toBeInTheDocument();
  });

  it('does not query sync cursors for viewer roles', async () => {
    render(<DeveloperSyncCursorsPanel workspaceRole="viewer" workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading sync cursors/i)).not.toBeInTheDocument();
    });

    expect(listSyncCursors).not.toHaveBeenCalled();
  });

  it('shows query errors instead of failing silently', async () => {
    vi.mocked(listSyncCursors).mockResolvedValue({
      cursors: [],
      error: 'permission denied for table sync_cursors',
    });

    render(<DeveloperSyncCursorsPanel workspaceRole="developer" workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText(/permission denied for table sync_cursors/i)).toBeInTheDocument();
    });
  });
});
