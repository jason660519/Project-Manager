import type { ReportMetadataStatus, ReportMetadataType } from '../supabase/cloudSchema';
import { getSupabaseBrowserClient } from './supabaseClient';

export interface PortalReport {
  id: string;
  workspaceId: string;
  projectId: string | null;
  projectName: string | null;
  reportKey: string;
  title: string;
  reportType: ReportMetadataType;
  status: ReportMetadataStatus;
  summary: string | null;
  contentUrl: string | null;
  publishedAt: string | null;
}

export interface PortalReportListResult {
  reports: PortalReport[];
  error: string | null;
}

type ReportMetadataRow = {
  id?: unknown;
  workspace_id?: unknown;
  project_id?: unknown;
  report_key?: unknown;
  title?: unknown;
  report_type?: unknown;
  status?: unknown;
  summary?: unknown;
  content_url?: unknown;
  published_at?: unknown;
  projects?: { name?: unknown } | Array<{ name?: unknown }> | null;
};

type ReportMetadataQuery = {
  eq: (
    column: string,
    value: string,
  ) => ReportMetadataQuery;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => Promise<{ data: ReportMetadataRow[] | null; error: { message?: string } | null }>;
};

type ReportMetadataSelect = {
  select: (columns: string) => ReportMetadataQuery;
};

export type ReportMetadataClient = {
  from: (table: 'report_metadata') => ReportMetadataSelect;
};

const REPORT_TYPES = new Set<ReportMetadataType>([
  'delivery_summary',
  'solution_detail',
  'run_summary',
  'milestone',
  'general',
]);

const REPORT_STATUSES = new Set<ReportMetadataStatus>(['draft', 'published', 'archived']);

function isReportType(value: unknown): value is ReportMetadataType {
  return typeof value === 'string' && REPORT_TYPES.has(value as ReportMetadataType);
}

function isReportStatus(value: unknown): value is ReportMetadataStatus {
  return typeof value === 'string' && REPORT_STATUSES.has(value as ReportMetadataStatus);
}

function getProjectName(row: ReportMetadataRow): string | null {
  const relation = Array.isArray(row.projects) ? row.projects[0] : row.projects;
  return typeof relation?.name === 'string' && relation.name.trim() ? relation.name : null;
}

export function normalizeReportMetadataRows(
  rows: ReportMetadataRow[] | null,
): PortalReport[] {
  return (rows ?? []).flatMap((row) => {
    if (
      typeof row.id !== 'string' ||
      typeof row.workspace_id !== 'string' ||
      typeof row.report_key !== 'string' ||
      typeof row.title !== 'string' ||
      !isReportType(row.report_type) ||
      !isReportStatus(row.status)
    ) {
      return [];
    }

    return [
      {
        id: row.id,
        workspaceId: row.workspace_id,
        projectId: typeof row.project_id === 'string' ? row.project_id : null,
        projectName: getProjectName(row),
        reportKey: row.report_key,
        title: row.title,
        reportType: row.report_type,
        status: row.status,
        summary: typeof row.summary === 'string' ? row.summary : null,
        contentUrl: typeof row.content_url === 'string' ? row.content_url : null,
        publishedAt: typeof row.published_at === 'string' ? row.published_at : null,
      },
    ];
  });
}

export async function listPortalReports(
  client: ReportMetadataClient = getSupabaseBrowserClient() as unknown as ReportMetadataClient,
  workspaceId?: string | null,
): Promise<PortalReportListResult> {
  try {
    const baseQuery = client
      .from('report_metadata')
      .select(
        'id, workspace_id, project_id, report_key, title, report_type, status, summary, content_url, published_at, projects(name)',
      );
    const scopedQuery =
      workspaceId && workspaceId.trim() ? baseQuery.eq('workspace_id', workspaceId) : baseQuery;
    const { data, error } = await scopedQuery.order('published_at', { ascending: false });

    if (error) {
      return {
        reports: [],
        error: error.message || 'Report metadata lookup failed.',
      };
    }

    return {
      reports: normalizeReportMetadataRows(data),
      error: null,
    };
  } catch (error) {
    return {
      reports: [],
      error: error instanceof Error ? error.message : 'Report metadata lookup failed.',
    };
  }
}

export function formatReportTypeLabel(reportType: ReportMetadataType): string {
  switch (reportType) {
    case 'delivery_summary':
      return 'Delivery summary';
    case 'solution_detail':
      return 'Solution detail';
    case 'run_summary':
      return 'Run summary';
    case 'milestone':
      return 'Milestone';
    default:
      return 'Report';
  }
}
