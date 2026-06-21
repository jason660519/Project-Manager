import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeveloperRunnersPanel } from '../app/developer/DeveloperRunnersPanel';

vi.mock('../lib/auth/runnerDevices', () => ({
  formatRunnerStatusLabel: (value: string) => value,
  listRunnerDevices: vi.fn(),
}));

import { listRunnerDevices } from '../lib/auth/runnerDevices';

describe('DeveloperRunnersPanel', () => {
  it('loads and renders paired runners for developer roles', async () => {
    vi.mocked(listRunnerDevices).mockResolvedValue({
      runners: [
        {
          id: 'runner-1',
          workspaceId: 'workspace-1',
          runnerId: 'runner-alpha',
          deviceLabel: 'MacBook Pro',
          status: 'ready',
          lastSeenAt: '2026-06-21T12:00:00.000Z',
          approvedProjectRoot: '/Users/dev/Project-Manager',
        },
      ],
      error: null,
    });

    render(<DeveloperRunnersPanel workspaceRole="developer" workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText('MacBook Pro')).toBeInTheDocument();
    });

    expect(screen.getByText('runner-alpha')).toBeInTheDocument();
    expect(screen.getByText(/Approved root:/)).toBeInTheDocument();
  });

  it('does not query runners for viewer roles', async () => {
    render(<DeveloperRunnersPanel workspaceRole="viewer" workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading runners/i)).not.toBeInTheDocument();
    });

    expect(listRunnerDevices).not.toHaveBeenCalled();
  });

  it('shows query errors instead of failing silently', async () => {
    vi.mocked(listRunnerDevices).mockResolvedValue({
      runners: [],
      error: 'permission denied for table runner_devices',
    });

    render(<DeveloperRunnersPanel workspaceRole="developer" workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText(/permission denied for table runner_devices/i)).toBeInTheDocument();
    });
  });
});
