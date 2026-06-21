import { getSupabaseBrowserClient } from './supabaseClient';

export interface PortalProject {
  id: string;
  workspaceId: string;
  name: string;
  solutionDetailUrl: string | null;
  createdAt: string;
}

export interface PortalProjectListResult {
  projects: PortalProject[];
  error: string | null;
}

type PortalProjectRow = {
  id?: unknown;
  workspace_id?: unknown;
  name?: unknown;
  solution_detail_url?: unknown;
  created_at?: unknown;
};

type PortalProjectQuery = {
  eq: (
    column: string,
    value: string,
  ) => PortalProjectQuery;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => Promise<{ data: PortalProjectRow[] | null; error: { message?: string } | null }>;
};

type PortalProjectSelect = {
  select: (columns: string) => PortalProjectQuery;
};

export type PortalProjectClient = {
  from: (table: 'projects') => PortalProjectSelect;
};

export function normalizePortalProjectRows(rows: PortalProjectRow[] | null): PortalProject[] {
  return (rows ?? []).flatMap((row) => {
    if (
      typeof row.id !== 'string' ||
      typeof row.workspace_id !== 'string' ||
      typeof row.name !== 'string' ||
      typeof row.created_at !== 'string'
    ) {
      return [];
    }

    return [
      {
        id: row.id,
        workspaceId: row.workspace_id,
        name: row.name,
        solutionDetailUrl:
          typeof row.solution_detail_url === 'string' && row.solution_detail_url.trim()
            ? row.solution_detail_url
            : null,
        createdAt: row.created_at,
      },
    ];
  });
}

export async function listPortalProjects(
  client: PortalProjectClient = getSupabaseBrowserClient() as unknown as PortalProjectClient,
  workspaceId?: string | null,
): Promise<PortalProjectListResult> {
  try {
    const baseQuery = client
      .from('projects')
      .select('id, workspace_id, name, solution_detail_url, created_at');
    const scopedQuery =
      workspaceId && workspaceId.trim() ? baseQuery.eq('workspace_id', workspaceId) : baseQuery;
    const { data, error } = await scopedQuery.order('created_at', { ascending: true });

    if (error) {
      return {
        projects: [],
        error: error.message || 'Project lookup failed.',
      };
    }

    return {
      projects: normalizePortalProjectRows(data),
      error: null,
    };
  } catch (error) {
    return {
      projects: [],
      error: error instanceof Error ? error.message : 'Project lookup failed.',
    };
  }
}
