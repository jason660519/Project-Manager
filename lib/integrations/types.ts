/** Unified integration inventory row — shared across Integrations Hub sheets. */

export type IntegrationSheet =
  | 'plugins'
  | 'skills'
  | 'channels'
  | 'memory'
  | 'commands'
  | 'company_standards'
  | 'connect';

export type IntegrationStatus =
  | 'installed'
  | 'connected'
  | 'running'
  | 'stopped'
  | 'warning'
  | 'unavailable'
  | 'not_installed'
  | 'idle';

export type IntegrationScope = 'user' | 'system' | 'project' | 'network' | 'intranet' | '';

/** Discriminant for detail panel actions */
export type IntegrationSourceKind =
  | 'plugin-installed'
  | 'plugin-marketplace'
  | 'skill'
  | 'channel'
  | 'command-mapping'
  | 'memory'
  | 'slash-command'
  | 'system-cli'
  | 'standards-provider';

export interface IntegrationManualFields {
  lv?: number;
  notes?: string;
  category1Override?: string;
  category2Override?: string;
  companyOverride?: string;
}

export interface IntegrationRow {
  /** Stable key for manual metadata, e.g. plugins:anthropic */
  rowKey: string;
  sheet: IntegrationSheet;
  sourceKind: IntegrationSourceKind;
  /** Source entity id (plugin id, channel id, skill path hash, etc.) */
  sourceId: string;

  enabled: boolean;
  category1: string;
  category2: string;
  githubUrl: string;
  company: string;
  name: string;
  version: string;
  license: string;
  scope: IntegrationScope;
  port: string;
  installPath: string;
  status: IntegrationStatus;
  statusLabel: string;
  lastUpdated: string;
  notes: string;
  lv: number | null;

  /** Extra badges for table (model count, key set, polling, etc.) */
  badges: string[];

  /** Opaque payload for detail sheet actions */
  payload: Record<string, unknown>;
}

export interface IntegrationManualStore {
  schemaVersion: 1;
  entries: Record<string, IntegrationManualFields>;
}
