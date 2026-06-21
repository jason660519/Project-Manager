import type { CloudFeatureStatus } from '../supabase/cloudSchema';
import { getSupabaseBrowserClient } from './supabaseClient';

export interface PortalFeature {
  id: string;
  workspaceId: string;
  projectId: string;
  projectName: string | null;
  featureKey: string;
  title: string;
  status: CloudFeatureStatus;
  progressPercent: number | null;
  solutionDetailUrl: string | null;
  updatedAt: string;
}

export interface PortalFeatureListResult {
  features: PortalFeature[];
  error: string | null;
}

type PortalFeatureRow = {
  id?: unknown;
  workspace_id?: unknown;
  project_id?: unknown;
  feature_key?: unknown;
  title?: unknown;
  status?: unknown;
  progress_percent?: unknown;
  solution_detail_url?: unknown;
  updated_at?: unknown;
  projects?: { name?: unknown } | Array<{ name?: unknown }> | null;
};

type PortalFeatureQuery = {
  eq: (
    column: string,
    value: string,
  ) => PortalFeatureQuery;
  is: (
    column: string,
    value: null,
  ) => PortalFeatureQuery;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => Promise<{ data: PortalFeatureRow[] | null; error: { message?: string } | null }>;
};

type PortalFeatureSelect = {
  select: (columns: string) => PortalFeatureQuery;
};

export type PortalFeatureClient = {
  from: (table: 'features') => PortalFeatureSelect;
};

const FEATURE_STATUSES = new Set<CloudFeatureStatus>([
  'planned',
  'in_progress',
  'blocked',
  'review',
  'done',
  'archived',
]);

function isFeatureStatus(value: unknown): value is CloudFeatureStatus {
  return typeof value === 'string' && FEATURE_STATUSES.has(value as CloudFeatureStatus);
}

function getProjectName(row: PortalFeatureRow): string | null {
  const relation = Array.isArray(row.projects) ? row.projects[0] : row.projects;
  return typeof relation?.name === 'string' && relation.name.trim() ? relation.name : null;
}

function normalizeProgressPercent(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizePortalFeatureRows(rows: PortalFeatureRow[] | null): PortalFeature[] {
  return (rows ?? []).flatMap((row) => {
    if (
      typeof row.id !== 'string' ||
      typeof row.workspace_id !== 'string' ||
      typeof row.project_id !== 'string' ||
      typeof row.feature_key !== 'string' ||
      typeof row.title !== 'string' ||
      !isFeatureStatus(row.status) ||
      typeof row.updated_at !== 'string'
    ) {
      return [];
    }

    return [
      {
        id: row.id,
        workspaceId: row.workspace_id,
        projectId: row.project_id,
        projectName: getProjectName(row),
        featureKey: row.feature_key,
        title: row.title,
        status: row.status,
        progressPercent: normalizeProgressPercent(row.progress_percent),
        solutionDetailUrl:
          typeof row.solution_detail_url === 'string' && row.solution_detail_url.trim()
            ? row.solution_detail_url
            : null,
        updatedAt: row.updated_at,
      },
    ];
  });
}

export async function listPortalFeatures(
  client: PortalFeatureClient = getSupabaseBrowserClient() as unknown as PortalFeatureClient,
  workspaceId?: string | null,
): Promise<PortalFeatureListResult> {
  try {
    const baseQuery = client
      .from('features')
      .select(
        'id, workspace_id, project_id, feature_key, title, status, progress_percent, solution_detail_url, updated_at, projects(name)',
      )
      .is('deleted_at', null);
    const scopedQuery =
      workspaceId && workspaceId.trim() ? baseQuery.eq('workspace_id', workspaceId) : baseQuery;
    const { data, error } = await scopedQuery.order('updated_at', { ascending: false });

    if (error) {
      return {
        features: [],
        error: error.message || 'Feature lookup failed.',
      };
    }

    return {
      features: normalizePortalFeatureRows(data),
      error: null,
    };
  } catch (error) {
    return {
      features: [],
      error: error instanceof Error ? error.message : 'Feature lookup failed.',
    };
  }
}

export function formatFeatureStatusLabel(status: CloudFeatureStatus): string {
  switch (status) {
    case 'planned':
      return 'Planned';
    case 'in_progress':
      return 'In progress';
    case 'blocked':
      return 'Blocked';
    case 'review':
      return 'Review';
    case 'done':
      return 'Done';
    case 'archived':
      return 'Archived';
    default:
      return status;
  }
}
