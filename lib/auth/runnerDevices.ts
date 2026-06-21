import type { DeveloperRunnerState } from './runnerStatus';
import { getSupabaseBrowserClient } from './supabaseClient';

export interface DeveloperRunnerDevice {
  id: string;
  workspaceId: string;
  runnerId: string;
  deviceLabel: string | null;
  status: DeveloperRunnerState;
  lastSeenAt: string | null;
  approvedProjectRoot: string | null;
}

export interface DeveloperRunnerDeviceListResult {
  runners: DeveloperRunnerDevice[];
  error: string | null;
}

type RunnerDeviceRow = {
  id?: unknown;
  workspace_id?: unknown;
  runner_id?: unknown;
  device_label?: unknown;
  status?: unknown;
  last_seen_at?: unknown;
  approved_project_root?: unknown;
};

type RunnerDeviceQuery = {
  eq: (
    column: string,
    value: string,
  ) => RunnerDeviceQuery;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => Promise<{ data: RunnerDeviceRow[] | null; error: { message?: string } | null }>;
};

type RunnerDeviceSelect = {
  select: (columns: string) => RunnerDeviceQuery;
};

export type RunnerDeviceClient = {
  from: (table: 'runner_devices') => RunnerDeviceSelect;
};

const RUNNER_STATES = new Set<DeveloperRunnerState>([
  'missing',
  'paired_offline',
  'project_blocked',
  'ready',
  'error',
]);

function isRunnerState(value: unknown): value is DeveloperRunnerState {
  return typeof value === 'string' && RUNNER_STATES.has(value as DeveloperRunnerState);
}

export function normalizeRunnerDeviceRows(rows: RunnerDeviceRow[] | null): DeveloperRunnerDevice[] {
  return (rows ?? []).flatMap((row) => {
    if (
      typeof row.id !== 'string' ||
      typeof row.workspace_id !== 'string' ||
      typeof row.runner_id !== 'string' ||
      !isRunnerState(row.status)
    ) {
      return [];
    }

    return [
      {
        id: row.id,
        workspaceId: row.workspace_id,
        runnerId: row.runner_id,
        deviceLabel: typeof row.device_label === 'string' ? row.device_label : null,
        status: row.status,
        lastSeenAt: typeof row.last_seen_at === 'string' ? row.last_seen_at : null,
        approvedProjectRoot:
          typeof row.approved_project_root === 'string' ? row.approved_project_root : null,
      },
    ];
  });
}

export async function listRunnerDevices(
  client: RunnerDeviceClient = getSupabaseBrowserClient() as unknown as RunnerDeviceClient,
  workspaceId?: string | null,
): Promise<DeveloperRunnerDeviceListResult> {
  try {
    const baseQuery = client
      .from('runner_devices')
      .select('id, workspace_id, runner_id, device_label, status, last_seen_at, approved_project_root');
    const scopedQuery =
      workspaceId && workspaceId.trim() ? baseQuery.eq('workspace_id', workspaceId) : baseQuery;
    const { data, error } = await scopedQuery.order('last_seen_at', { ascending: false });

    if (error) {
      return {
        runners: [],
        error: error.message || 'Runner device lookup failed.',
      };
    }

    return {
      runners: normalizeRunnerDeviceRows(data),
      error: null,
    };
  } catch (error) {
    return {
      runners: [],
      error: error instanceof Error ? error.message : 'Runner device lookup failed.',
    };
  }
}

export function formatRunnerStatusLabel(status: DeveloperRunnerState): string {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'paired_offline':
      return 'Offline';
    case 'project_blocked':
      return 'Project blocked';
    case 'missing':
      return 'Not connected';
    case 'error':
      return 'Error';
    default:
      return status;
  }
}
