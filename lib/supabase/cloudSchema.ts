/** Postgres row shapes for PM cloud tables (metadata only — not full feature content). */

import type { DeveloperRunnerState } from '../auth/runnerStatus';

export type CloudFeatureStatus =
  | 'planned'
  | 'in_progress'
  | 'blocked'
  | 'review'
  | 'done'
  | 'archived';

export interface CloudFeatureRow {
  id: string;
  workspace_id: string;
  project_id: string;
  feature_key: string;
  title: string;
  status: CloudFeatureStatus;
  progress_percent: number | null;
  local_config_path: string | null;
  solution_detail_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AuditLogRow {
  id: string;
  workspace_id: string;
  actor_user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RunnerDeviceRow {
  id: string;
  workspace_id: string;
  runner_id: string;
  device_label: string | null;
  paired_by_user_id: string | null;
  status: DeveloperRunnerState;
  last_seen_at: string | null;
  approved_project_root: string | null;
  error_summary: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Canonical runner link is runner_device_id; runner_id is a denormalized snapshot. */
export interface AgentRunRow {
  id: string;
  workspace_id: string;
  project_id: string | null;
  runner_device_id: string | null;
  runner_id: string | null;
  status: string;
  summary: string | null;
  created_at: string;
}

export type ReportMetadataType =
  | 'delivery_summary'
  | 'solution_detail'
  | 'run_summary'
  | 'milestone'
  | 'general';

export type ReportMetadataStatus = 'draft' | 'published' | 'archived';

/** Portal index row — content lives at content_url or storage_path, not in Postgres. */
export interface ReportMetadataRow {
  id: string;
  workspace_id: string;
  project_id: string | null;
  feature_id: string | null;
  agent_run_id: string | null;
  report_key: string;
  title: string;
  report_type: ReportMetadataType;
  status: ReportMetadataStatus;
  summary: string | null;
  content_url: string | null;
  storage_path: string | null;
  content_sha: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type SyncResourceType = 'project_config' | 'progress_sheet' | 'feature_manifest';

export type SyncCursorStatus = 'idle' | 'pending' | 'conflict' | 'error';

export interface SyncCursorRow {
  id: string;
  workspace_id: string;
  project_id: string | null;
  resource_type: SyncResourceType;
  resource_key: string;
  local_revision: string | null;
  cloud_revision: string | null;
  last_synced_at: string | null;
  sync_status: SyncCursorStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
