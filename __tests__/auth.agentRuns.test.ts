import { describe, expect, it, vi } from 'vitest';
import {
  formatAgentRunStatusLabel,
  isDispatchQueueStatus,
  listAgentRuns,
  normalizeAgentRunRows,
  type AgentRunClient,
} from '../lib/auth/agentRuns';

function clientWithResult(
  result: {
    data: Parameters<typeof normalizeAgentRunRows>[0];
    error: { message?: string } | null;
  },
): AgentRunClient {
  const order = vi.fn(async () => result);
  const eq = vi.fn((): { eq: typeof eq; order: typeof order } => ({ eq, order }));
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq, order })),
    })),
  };
}

describe('developer agent run query helpers', () => {
  it('normalizes valid agent run rows and drops malformed entries', () => {
    expect(
      normalizeAgentRunRows([
        {
          id: 'run-1',
          workspace_id: 'workspace-1',
          project_id: 'project-1',
          runner_device_id: 'runner-device-1',
          runner_id: 'runner-alpha',
          status: 'running',
          summary: 'Executing feature slice.',
          created_at: '2026-06-21T12:00:00.000Z',
          projects: { name: 'Alpha Project' },
        },
        {
          id: 'run-2',
          status: 'queued',
          created_at: '2026-06-21T12:00:00.000Z',
        },
      ]),
    ).toEqual([
      {
        id: 'run-1',
        workspaceId: 'workspace-1',
        projectId: 'project-1',
        projectName: 'Alpha Project',
        runnerDeviceId: 'runner-device-1',
        runnerId: 'runner-alpha',
        status: 'running',
        summary: 'Executing feature slice.',
        createdAt: '2026-06-21T12:00:00.000Z',
      },
    ]);
  });

  it('loads agent runs through the Supabase client abstraction', async () => {
    const client = clientWithResult({
      data: [
        {
          id: 'run-completed',
          workspace_id: 'workspace-1',
          project_id: null,
          runner_id: 'runner-alpha',
          status: 'succeeded',
          summary: 'Run finished cleanly.',
          created_at: '2026-06-21T12:00:00.000Z',
        },
      ],
      error: null,
    });

    await expect(listAgentRuns(client)).resolves.toEqual({
      runs: [
        expect.objectContaining({
          id: 'run-completed',
          status: 'succeeded',
        }),
      ],
      error: null,
    });

    expect(client.from).toHaveBeenCalledWith('agent_runs');
  });

  it('returns a visible error when Supabase rejects the agent run query', async () => {
    const client = clientWithResult({
      data: null,
      error: { message: 'permission denied for table agent_runs' },
    });

    await expect(listAgentRuns(client)).resolves.toEqual({
      runs: [],
      error: 'permission denied for table agent_runs',
    });
  });

  it('classifies dispatch queue statuses', () => {
    expect(isDispatchQueueStatus('queued')).toBe(true);
    expect(isDispatchQueueStatus('running')).toBe(true);
    expect(isDispatchQueueStatus('succeeded')).toBe(false);
  });

  it('formats agent run status labels for the developer console', () => {
    expect(formatAgentRunStatusLabel('running')).toBe('Running');
    expect(formatAgentRunStatusLabel('succeeded')).toBe('Succeeded');
  });
});
