import { AGENT_TEAM_DIR } from '../defaults/agentTeamProtocol';
import { DEFAULT_ENGINEER_ROLES } from '../defaults/engineerRoles';
import {
  listProgressTemplates,
  resolveProgressTemplate,
  type ProgressTemplateDefinition,
} from '../progress-sheets/catalog';
import type {
  Feature,
  FeatureStatus,
  IDEId,
  ProjectManagerConfig,
  ProjectProgressSheetRef,
} from '../types';
import { CURRENT_SCHEMA_VERSION, migrateConfig } from './migrate';
import { mergeEngineerRolesById } from './mergeEngineerRoles';

/** Relative directories created on every project initialize. */
export const SCAFFOLD_DOC_DIRS = [
  '.project-manager/features',
  '.project-manager/dev-logs',
  AGENT_TEAM_DIR,
] as const;

export const DEFAULT_DEV_LOG_FOLDER = '.project-manager/dev-logs/';

export interface FeatureReadmeSnapshot {
  featureId: string;
  relativePath: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DashboardArtifactSnapshot {
  featureReadmes: FeatureReadmeSnapshot[];
  relativePaths: string[];
}

export type InitializeMode = 'create' | 'merge' | 'overwrite';

export interface InitializeProjectOptions {
  /** Folder name used when `projectRoot` has no trailing segment. */
  projectName?: string;
  defaultIDE?: IDEId;
  /** Progress sheet templates to initialize. Defaults to the software desktop sheet. */
  progressSheetTemplateIds?: string[];
  /** Optional template catalog used to resolve custom sheet ids during scaffold generation. */
  progressSheetTemplates?: ProgressTemplateDefinition[];
}

/** Default feature spec path under the consolidated dashboard feature folder. */
export function defaultFeatureSpecPath(featureId: string, _featureName: string): string {
  return `.project-manager/features/${featureId}/feature-spec.md`;
}

/** Default paths block for a new feature row. */
export function defaultFeaturePaths(featureId: string, featureName: string) {
  return {
    featureFolder: `.project-manager/features/${featureId}/`,
    spec: defaultFeatureSpecPath(featureId, featureName),
    developmentLogSummaryFolder: DEFAULT_DEV_LOG_FOLDER,
  };
}

/** Fill missing spec / dev-log paths without clobbering user-set values. */
export function ensureFeaturePaths(features: Feature[]): Feature[] {
  return features.map((f) => ({
    ...f,
    paths: {
      ...defaultFeaturePaths(f.id, f.name),
      ...f.paths,
    },
  }));
}

function inferProjectName(projectRoot: string, override?: string): string {
  if (override?.trim()) return override.trim();
  const trimmed = projectRoot.replace(/\/+$/, '');
  const segment = trimmed.split('/').pop();
  return segment || 'Project';
}

function buildProgressSheetRefs(
  templateIds: string[] | undefined,
  timestamp: string,
  templateCatalog: ReadonlyArray<ProgressTemplateDefinition>,
): ProjectProgressSheetRef[] {
  const selectedTemplateIds = templateIds ?? ['software-desktop-app'];
  if (selectedTemplateIds.length === 0) {
    throw new Error('At least one progress sheet template must be selected');
  }

  const seen = new Set<string>();
  return selectedTemplateIds.map((templateId, index) => {
    if (seen.has(templateId)) {
      throw new Error(`Duplicate progress sheet template selected: ${templateId}`);
    }
    seen.add(templateId);

    const template = resolveProgressTemplate(templateId, templateCatalog);
    if (!template) {
      throw new Error(`Unknown progress sheet template: ${templateId}`);
    }

    return {
      id: template.id,
      label: template.sheetTitle,
      discipline: template.discipline,
      configPath: `.project-manager/progress-sheets/${template.id}/config.json`,
      templateId: template.id,
      templateVersion: template.version,
      active: index === 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
}

function mergeProgressSheetRefs(
  existingRefs: ProjectProgressSheetRef[] | undefined,
  scaffoldRefs: ProjectProgressSheetRef[] | undefined,
): ProjectProgressSheetRef[] | undefined {
  const existing = existingRefs ?? [];
  const scaffold = scaffoldRefs ?? [];
  if (existing.length === 0) return scaffoldRefs;
  if (scaffold.length === 0) return existingRefs;

  const seen = new Set(existing.map((sheet) => sheet.id));
  const additions = scaffold
    .filter((sheet) => {
      if (seen.has(sheet.id)) return false;
      seen.add(sheet.id);
      return true;
    })
    .map((sheet) => ({ ...sheet, active: false }));

  return [...existing, ...additions];
}

function extractLineValue(markdown: string, label: string): string | undefined {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`\\*\\*${escaped}\\*\\*:\\s*([^\\n|]+)`, 'i'));
  return match?.[1]?.trim();
}

function extractBacktickValue(markdown: string, label: string): string | undefined {
  const value = extractLineValue(markdown, label);
  const match = value?.match(/`([^`]+)`/);
  return match?.[1]?.trim() || value;
}

function normalizeStatus(raw: string | undefined): FeatureStatus {
  const value = raw?.trim();
  return value === 'todo' ||
    value === 'in_progress' ||
    value === 'done' ||
    value === 'on_hold'
    ? value
    : 'todo';
}

function normalizeProgress(raw: string | undefined, status: FeatureStatus): number {
  const value = Number(raw?.match(/\d+/)?.[0]);
  if (Number.isFinite(value)) return Math.max(0, Math.min(100, value));
  return status === 'done' ? 100 : 0;
}

function titleFromReadme(featureId: string, content: string): string {
  const title = content.match(new RegExp(`^#\\s+${featureId}\\s+[—-]\\s+(.+)$`, 'm'))?.[1];
  return title?.trim() || featureId;
}

function hasRelPath(snapshot: DashboardArtifactSnapshot, relativePath: string): boolean {
  return snapshot.relativePaths.includes(relativePath);
}

export function hasRecoverableDashboardArtifacts(
  snapshot: DashboardArtifactSnapshot,
): boolean {
  return snapshot.featureReadmes.length > 0;
}

/**
 * Rebuild a canonical config from existing dashboard-owned feature docs.
 *
 * This is intentionally deterministic and does not call AI. It is used when
 * `.project-manager/config.json` is missing but `.project-manager/features/`
 * still contains the user's canonical feature documentation.
 */
export function buildRecoveredProjectConfig(
  projectRoot: string,
  snapshot: DashboardArtifactSnapshot,
  options: InitializeProjectOptions = {},
): ProjectManagerConfig {
  const root = projectRoot.replace(/\/+$/, '');
  const now = new Date().toISOString();
  const progressTemplateCatalog = options.progressSheetTemplates ?? listProgressTemplates();
  const features = [...snapshot.featureReadmes]
    .sort((a, b) => a.featureId.localeCompare(b.featureId, undefined, { numeric: true }))
    .map((doc): Feature => {
      const featureFolder = `.project-manager/features/${doc.featureId}/`;
      const status = normalizeStatus(extractLineValue(doc.content, 'Status'));
      const paths = {
        featureFolder,
        ...(extractBacktickValue(doc.content, 'Implementation')
          ? { implementation: extractBacktickValue(doc.content, 'Implementation') }
          : {}),
        ...(extractBacktickValue(doc.content, 'Spec')
          ? { spec: extractBacktickValue(doc.content, 'Spec') }
          : {}),
        ...(hasRelPath(snapshot, `${featureFolder}feature-spec.md`)
          ? { spec: `${featureFolder}feature-spec.md` }
          : {}),
        ...(hasRelPath(snapshot, `${featureFolder}tdd-spec.md`)
          ? { tdd: `${featureFolder}tdd-spec.md` }
          : {}),
        ...(hasRelPath(snapshot, `${featureFolder}debug-retro.md`)
          ? { debugRetro: `${featureFolder}debug-retro.md` }
          : {}),
        ...(hasRelPath(snapshot, `${featureFolder}test-scenarios.md`)
          ? { testScenarios: `${featureFolder}test-scenarios.md` }
          : {}),
        ...(hasRelPath(snapshot, `${featureFolder}dev-log.md`)
          ? { developmentLogSummaryFolder: featureFolder }
          : extractBacktickValue(doc.content, 'Dev Logs')
            ? { developmentLogSummaryFolder: extractBacktickValue(doc.content, 'Dev Logs') }
            : {}),
      };

      return {
        id: doc.featureId,
        name: titleFromReadme(doc.featureId, doc.content),
        category: extractLineValue(doc.content, 'Category') || 'Uncategorized',
        status,
        progress: normalizeProgress(extractLineValue(doc.content, 'Progress'), status),
        paths,
        readmePath: doc.relativePath,
        createdAt: doc.createdAt ?? doc.updatedAt ?? now,
        updatedAt: doc.updatedAt ?? now,
        phase: 'development',
        points: 1,
      };
    });

  const recovered = migrateConfig({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: features[0]?.createdAt ?? now,
    updatedAt: now,
    updatedBy: 'project-manager-recovery',
    project: {
      name: inferProjectName(root, options.projectName),
      root,
      defaultIDE: options.defaultIDE ?? 'Cursor',
    },
    features,
    engineerRoles: DEFAULT_ENGINEER_ROLES,
    adapters: {
      ides: [
        { id: 'Cursor', name: 'Cursor', type: 'ide', command: 'cursor' },
        { id: 'VSCode', name: 'Visual Studio Code', type: 'ide', command: 'code' },
      ],
      agents: [
        {
          id: 'claude-code',
          name: 'Claude Code',
          type: 'agent',
          command: 'claude',
          argsTemplate: ['--cwd', '{root}', '{prompt}'],
        },
        {
          id: 'codex',
          name: 'Codex',
          type: 'agent',
          command: 'codex',
          argsTemplate: ['--cwd', '{root}', '{prompt}'],
        },
      ],
    },
  });
  return {
    ...recovered,
    progressSheets: buildProgressSheetRefs(options.progressSheetTemplateIds, now, progressTemplateCatalog),
  };
}

/**
 * Build a minimal schema-v3 config for a new local project.
 * Does not touch disk — callers write via `initializeProject` bridge.
 */
export function buildProjectScaffold(
  projectRoot: string,
  options: InitializeProjectOptions = {},
): ProjectManagerConfig {
  const root = projectRoot.replace(/\/+$/, '');
  const now = new Date().toISOString();
  const progressTemplateCatalog = options.progressSheetTemplates ?? listProgressTemplates();
  const raw = {
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    updatedBy: 'project-manager',
    project: {
      name: inferProjectName(root, options.projectName),
      root,
      defaultIDE: options.defaultIDE ?? 'Cursor',
    },
    features: [] as Feature[],
    engineerRoles: DEFAULT_ENGINEER_ROLES,
    adapters: { ides: [], agents: [] },
  };
  const scaffold = migrateConfig(raw);
  return {
    ...scaffold,
    progressSheets: buildProgressSheetRefs(options.progressSheetTemplateIds, now, progressTemplateCatalog),
  };
}

/**
 * Merge an on-disk config with a fresh scaffold:
 * - structural feature fields from disk win; PM edits (status/progress/notes) overlay
 * - engineer roles: union by id with defaults filling gaps
 * - adapters: keep disk when non-empty, else scaffold
 * - project metadata: disk name/root win when present
 */
export function mergeProjectConfig(
  existing: ProjectManagerConfig,
  scaffold: ProjectManagerConfig,
): ProjectManagerConfig {
  const next = migrateConfig({
    ...scaffold,
    ...existing,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    project: {
      ...scaffold.project,
      ...existing.project,
      root: existing.project.root || scaffold.project.root,
      name: existing.project.name || scaffold.project.name,
      defaultIDE: existing.project.defaultIDE || scaffold.project.defaultIDE,
    },
    features: ensureFeaturePaths(existing.features ?? []),
    engineerRoles: mergeEngineerRolesById(existing.engineerRoles, scaffold.engineerRoles),
    progressSheets: mergeProgressSheetRefs(existing.progressSheets, scaffold.progressSheets),
    adapters: {
      ides:
        (existing.adapters?.ides?.length ?? 0) > 0
          ? existing.adapters!.ides
          : scaffold.adapters.ides,
      agents:
        (existing.adapters?.agents?.length ?? 0) > 0
          ? existing.adapters!.agents
          : scaffold.adapters.agents,
      apps:
        (existing.adapters?.apps?.length ?? 0) > 0
          ? existing.adapters!.apps
          : scaffold.adapters.apps,
    },
  });
  return migrateConfig(next);
}

/** Fresh scaffold for overwrite — preserves project display name when provided. */
export function buildOverwriteScaffold(
  projectRoot: string,
  preserveName?: string,
  options: InitializeProjectOptions = {},
): ProjectManagerConfig {
  const scaffold = buildProjectScaffold(projectRoot, options);
  if (preserveName?.trim()) {
    return { ...scaffold, project: { ...scaffold.project, name: preserveName.trim() } };
  }
  return scaffold;
}
