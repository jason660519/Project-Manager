import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeveloperAgentRunsPanel } from '../app/developer/DeveloperAgentRunsPanel';

vi.mock('../lib/auth/agentRuns', () => ({
  formatAgentRunStatusLabel: (value: string) => value,
  isDispatchQueueStatus: (value: string) =>
    value === 'queued' || value === 'running' || value === 'pending' || value === 'dispatching',
  listAgentRuns: vi.fn(),
}));

import { listAgentRuns } from '../lib/auth/agentRuns';

describe('DeveloperAgentRunsPanel', () => {
  it('loads and renders dispatch queue and execution logs for developer roles', async () => {
    vi.mocked(listAgentRuns).mockResolvedValue({
      runs: [
        {
          id: 'run-queued',
          workspaceId: 'workspace-1',
          projectId: 'project-1',
          projectName: 'Alpha Project',
          runnerDeviceId: 'runner-device-1',
          runnerId: 'runner-alpha',
          status: 'queued',
          summary: 'Waiting for runner pickup.',
          createdAt: '2026-06-21T12:00:00.000Z',
        },
        {
          id: 'run-done',
          workspaceId: 'workspace-1',
          projectId: 'project-1',
          projectName: 'Alpha Project',
          runnerDeviceId: 'runner-device-1',
          runnerId: 'runner-alpha',
          status: 'succeeded',
          summary: 'Completed cleanly.',
          createdAt: '2026-06-21T11:00:00.000Z',
        },
      ],
      error: null,
    });

    render(<DeveloperAgentRunsPanel workspaceRole="developer" workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText('Waiting for runner pickup.')).toBeInTheDocument();
    });

    expect(screen.getByText('Completed cleanly.')).toBeInTheDocument();
    expect(screen.getByText('Dispatch queue')).toBeInTheDocument();
    expect(screen.getByText('Execution logs')).toBeInTheDocument();
  });

  it('does not query agent runs for viewer roles', async () => {
    render(<DeveloperAgentRunsPanel workspaceRole="viewer" workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading dispatch queue/i)).not.toBeInTheDocument();
    });

    expect(listAgentRuns).not.toHaveBeenCalled();
  });

  it('shows query errors instead of failing silently', async () => {
    vi.mocked(listAgentRuns).mockResolvedValue({
      runs: [],
      error: 'permission denied for table agent_runs',
    });

    render(<DeveloperAgentRunsPanel workspaceRole="developer" workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getAllByText(/permission denied for table agent_runs/i).length).toBeGreaterThan(
        0,
      );
    });
  });
});
