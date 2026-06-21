import { describe, expect, it, vi } from 'vitest';
import {
  formatRunnerStatusLabel,
  listRunnerDevices,
  normalizeRunnerDeviceRows,
  type RunnerDeviceClient,
} from '../lib/auth/runnerDevices';

function clientWithResult(
  result: {
    data: Parameters<typeof normalizeRunnerDeviceRows>[0];
    error: { message?: string } | null;
  },
): RunnerDeviceClient {
  const order = vi.fn(async () => result);
  const eq = vi.fn((): { eq: typeof eq; order: typeof order } => ({ eq, order }));
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq, order })),
    })),
  };
}

describe('developer runner device query helpers', () => {
  it('normalizes valid runner rows and drops malformed entries', () => {
    expect(
      normalizeRunnerDeviceRows([
        {
          id: 'runner-1',
          workspace_id: 'workspace-1',
          runner_id: 'runner-alpha',
          device_label: 'MacBook Pro',
          status: 'ready',
          last_seen_at: '2026-06-21T12:00:00.000Z',
          approved_project_root: '/Users/dev/Project-Manager',
        },
        {
          id: 'runner-2',
          runner_id: 'runner-beta',
          status: 'ready',
        },
      ]),
    ).toEqual([
      {
        id: 'runner-1',
        workspaceId: 'workspace-1',
        runnerId: 'runner-alpha',
        deviceLabel: 'MacBook Pro',
        status: 'ready',
        lastSeenAt: '2026-06-21T12:00:00.000Z',
        approvedProjectRoot: '/Users/dev/Project-Manager',
      },
    ]);
  });

  it('loads runner devices through the Supabase client abstraction', async () => {
    const client = clientWithResult({
      data: [
        {
          id: 'runner-1',
          workspace_id: 'workspace-1',
          runner_id: 'runner-alpha',
          device_label: 'MacBook Pro',
          status: 'paired_offline',
          last_seen_at: null,
          approved_project_root: null,
        },
      ],
      error: null,
    });

    await expect(listRunnerDevices(client)).resolves.toEqual({
      runners: [
        expect.objectContaining({
          runnerId: 'runner-alpha',
          status: 'paired_offline',
        }),
      ],
      error: null,
    });

    expect(client.from).toHaveBeenCalledWith('runner_devices');
  });

  it('returns a visible error when Supabase rejects the runner query', async () => {
    const client = clientWithResult({
      data: null,
      error: { message: 'permission denied for table runner_devices' },
    });

    await expect(listRunnerDevices(client)).resolves.toEqual({
      runners: [],
      error: 'permission denied for table runner_devices',
    });
  });

  it('formats runner status labels for the developer console', () => {
    expect(formatRunnerStatusLabel('ready')).toBe('Ready');
    expect(formatRunnerStatusLabel('paired_offline')).toBe('Offline');
  });
});
