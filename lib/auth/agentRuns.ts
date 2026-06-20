import { getSupabaseBrowserClient } from './supabaseClient';

export type AgentRunStatus =
  | 'queued'
  | 'pending'
  | 'running'
  | 'dispatching'
  | 'succeeded'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'error';

export interface DeveloperAgentRun {
  id: string;
  workspaceId: string;
  projectId: string | null;
  projectName: string | null;
  runnerDeviceId: string | null;
  runnerId: string | null;
  status: string;
  summary: string | null;
  createdAt: string;
}

export interface DeveloperAgentRunListResult {
  runs: DeveloperAgentRun[];
  error: string | null;
}

type AgentRunRow = {
  id?: unknown;
  workspace_id?: unknown;
  project_id?: unknown;
  runner_device_id?: unknown;
  runner_id?: unknown;
  status?: unknown;
  summary?: unknown;
  created_at?: unknown;
  projects?: { name?: unknown } | Array<{ name?: unknown }> | null;
};

type AgentRunQuery = {
  eq: (
    column: string,
    value: string,
  ) => AgentRunQuery;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => Promise<{ data: AgentRunRow[] | null; error: { message?: string } | null }>;
};

type AgentRunSelect = {
  select: (columns: string) => AgentRunQuery;
};

export type AgentRunClient = {
  from: (table: 'agent_runs') => AgentRunSelect;
};

const DISPATCH_QUEUE_STATUSES = new Set<string>([
  'queued',
  'pending',
  'running',
  'dispatching',
]);

function getProjectName(row: AgentRunRow): string | null {
  const relation = Array.isArray(row.projects) ? row.projects[0] : row.projects;
  return typeof relation?.name === 'string' && relation.name.trim() ? relation.name : null;
}

export function normalizeAgentRunRows(rows: AgentRunRow[] | null): DeveloperAgentRun[] {
  return (rows ?? []).flatMap((row) => {
    if (
      typeof row.id !== 'string' ||
      typeof row.workspace_id !== 'string' ||
      typeof row.status !== 'string' ||
      typeof row.created_at !== 'string'
    ) {
      return [];
    }

    return [
      {
        id: row.id,
        workspaceId: row.workspace_id,
        projectId: typeof row.project_id === 'string' ? row.project_id : null,
        projectName: getProjectName(row),
        runnerDeviceId: typeof row.runner_device_id === 'string' ? row.runner_device_id : null,
        runnerId: typeof row.runner_id === 'string' ? row.runner_id : null,
        status: row.status,
        summary: typeof row.summary === 'string' ? row.summary : null,
        createdAt: row.created_at,
      },
    ];
  });
}

export async function listAgentRuns(
  client: AgentRunClient = getSupabaseBrowserClient() as unknown as AgentRunClient,
  workspaceId?: string | null,
): Promise<DeveloperAgentRunListResult> {
  try {
    const baseQuery = client
      .from('agent_runs')
      .select(
        'id, workspace_id, project_id, runner_device_id, runner_id, status, summary, created_at, projects(name)',
      );
    const scopedQuery =
      workspaceId && workspaceId.trim() ? baseQuery.eq('workspace_id', workspaceId) : baseQuery;
    const { data, error } = await scopedQuery.order('created_at', { ascending: false });

    if (error) {
      return {
        runs: [],
        error: error.message || 'Agent run lookup failed.',
      };
    }

    return {
      runs: normalizeAgentRunRows(data),
      error: null,
    };
  } catch (error) {
    return {
      runs: [],
      error: error instanceof Error ? error.message : 'Agent run lookup failed.',
    };
  }
}

export function isDispatchQueueStatus(status: string): boolean {
  return DISPATCH_QUEUE_STATUSES.has(status);
}

export function formatAgentRunStatusLabel(status: string): string {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'pending':
      return 'Pending';
    case 'running':
      return 'Running';
    case 'dispatching':
      return 'Dispatching';
    case 'succeeded':
      return 'Succeeded';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    case 'error':
      return 'Error';
    default:
      return status.replace(/_/g, ' ');
  }
}
