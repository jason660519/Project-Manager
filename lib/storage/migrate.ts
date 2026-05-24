import type { CapabilityCandidate, ProjectManagerConfig, Feature } from '../types';
import { BUILT_IN_ADAPTER_SUPPORTS, mergeSeedCandidates } from '../capabilities/registry';

/**
 * Pure migration pipeline for dashboard config JSON documents
 * (`.project-manager/config.json` — ADR-008; previously `.project-manager.json`).
 *
 * v1 → v2 (ADR-006): adds a stable root `id` (UUID) plus `createdAt` /
 * `updatedAt` / `updatedBy` audit fields on the root and on every feature.
 * Required for any future cross-device sync — without a stable id and a
 * monotonic clock there's no way to reconcile two edits.
 *
 * Idempotent: passing a v2 config returns it unchanged (modulo back-filling
 * any optional field that happens to be missing).
 */

interface RawConfig {
  schemaVersion?: number;
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
  features?: unknown;
  [key: string]: unknown;
}

export const CURRENT_SCHEMA_VERSION = 7;

export function migrateConfig(raw: unknown): ProjectManagerConfig {
  const cfg = (raw && typeof raw === 'object' ? (raw as RawConfig) : {}) as RawConfig;
  const version = typeof cfg.schemaVersion === 'number' ? cfg.schemaVersion : 1;
  let next: RawConfig = { ...cfg };
  if (version < 2) next = migrate_1_to_2(next);
  if (version < 3) next = migrate_2_to_3(next);
  if (version < 4) next = migrate_3_to_4(next);
  if (version < 5) next = migrate_4_to_5(next);
  if (version < 6) next = migrate_5_to_6(next);
  if (version < 7) next = migrate_6_to_7(next);
  // Cast through unknown: `RawConfig` is intentionally a permissive bag,
  // and the migration steps above are responsible for ensuring the result
  // matches `ProjectManagerConfig`.
  return next as unknown as ProjectManagerConfig;
}

function migrate_1_to_2(cfg: RawConfig): RawConfig {
  const now = new Date().toISOString();
  const id = typeof cfg.id === 'string' && cfg.id.length > 0 ? cfg.id : generateUUID();
  const features = Array.isArray(cfg.features)
    ? (cfg.features as Feature[]).map((f) => ({
        ...f,
        createdAt: f.createdAt ?? now,
        updatedAt: f.updatedAt ?? now,
      }))
    : [];
  return {
    ...cfg,
    schemaVersion: 2,
    id,
    createdAt: typeof cfg.createdAt === 'string' ? cfg.createdAt : now,
    updatedAt: typeof cfg.updatedAt === 'string' ? cfg.updatedAt : now,
    features,
  };
}

/**
 * v2 → v3: introduces the project-progress phase model. All existing features
 * default to 'development' and `points: 1`; nothing else is required. Other
 * phase-specific fields stay undefined so the UI shows them as "—".
 */
function migrate_2_to_3(cfg: RawConfig): RawConfig {
  const features = Array.isArray(cfg.features)
    ? (cfg.features as Feature[]).map((f) => ({
        ...f,
        phase: f.phase ?? 'development',
        points: typeof f.points === 'number' && f.points > 0 ? f.points : 1,
      }))
    : [];
  return {
    ...cfg,
    schemaVersion: 3,
    features,
  };
}

/**
 * v3 → v4: renames the lifecycle phase `testing` → `e2e_testing` (E2E tab).
 */
function migrate_3_to_4(cfg: RawConfig): RawConfig {
  const features = Array.isArray(cfg.features)
    ? (cfg.features as Feature[]).map((f) => ({
        ...f,
        phase: (f as { phase?: string }).phase === 'testing' ? 'e2e_testing' : f.phase,
      }))
    : [];
  return {
    ...cfg,
    schemaVersion: 4,
    features,
  };
}

/**
 * v4 → v5: splits README file pointers from free-form notes.
 *
 * Historically `Feature.notes` was used for both short text and README paths,
 * which caused UI code to try opening prose as a filesystem path. v5 adds
 * `readmePath` as the canonical README pointer and keeps `notes` for text.
 */
function migrate_4_to_5(cfg: RawConfig): RawConfig {
  const features = Array.isArray(cfg.features)
    ? (cfg.features as Feature[]).map((f) => {
        const legacyNotes = typeof f.notes === 'string' ? f.notes.trim() : undefined;
        const readmePath =
          (f as Feature & { readmePath?: string }).readmePath ??
          (legacyNotes && looksLikeReadmePath(legacyNotes) ? legacyNotes : undefined) ??
          (f.paths?.spec && looksLikeReadmePath(f.paths.spec) ? f.paths.spec : undefined) ??
          (f.paths?.featureFolder ? `${f.paths.featureFolder.replace(/\/?$/, '/')}README.md` : undefined);
        const summary =
          legacyNotes && looksLikeReadmePath(legacyNotes)
            ? stringFromMetadata(f.metadata, 'notesSummary')
            : legacyNotes || undefined;
        const paths =
          f.paths?.spec && looksLikeReadmePath(f.paths.spec)
            ? { ...f.paths, spec: undefined }
            : f.paths;
        return {
          ...f,
          paths,
          readmePath,
          notes: summary,
        };
      })
    : [];
  return {
    ...cfg,
    schemaVersion: 5,
    features,
  };
}

/**
 * v5 → v6: rename `locatedPage` to `locatedSection`.
 *
 * The dashboard now tracks a broader "where this lives" hint that can be a
 * section, module, flow segment, or route. Keep old configs readable by
 * lifting legacy `locatedPage` into `locatedSection` when needed.
 */
function migrate_5_to_6(cfg: RawConfig): RawConfig {
  const features = Array.isArray(cfg.features)
    ? (cfg.features as Array<Feature & { locatedPage?: string }>).map((f) => {
        const locatedSection =
          f.locatedSection ??
          (typeof f.locatedPage === 'string' ? f.locatedPage : undefined);
        const { locatedPage: _legacyLocatedPage, ...rest } = f;
        void _legacyLocatedPage;
        return {
          ...rest,
          locatedSection,
        };
      })
    : [];
  return {
    ...cfg,
    schemaVersion: 6,
    features,
  };
}

/**
 * v6 → v7 (F23 Engineer Capabilities): introduces `capabilities` on engineer
 * roles, `supports`/`traits` on adapters, and a top-level `capabilityCandidates`
 * array surfaced in the Integrations Hub VLA / TTS / STT / Hands / Tools sheets.
 * Purely additive — existing roles get `capabilities: []` and continue to function.
 */
function migrate_6_to_7(cfg: RawConfig): RawConfig {
  const rolesIn = cfg.engineerRoles;
  const engineerRoles = Array.isArray(rolesIn)
    ? (rolesIn as Array<Record<string, unknown>>).map((r) => ({
        ...r,
        capabilities: Array.isArray(r.capabilities) ? r.capabilities : [],
      }))
    : undefined;

  const adaptersIn =
    cfg.adapters && typeof cfg.adapters === 'object'
      ? (cfg.adapters as { ides?: unknown; agents?: unknown; apps?: unknown })
      : undefined;
  const adapters = adaptersIn
    ? {
        ...adaptersIn,
        ides:   annotateAdapterSupports(adaptersIn.ides),
        agents: annotateAdapterSupports(adaptersIn.agents),
        apps:   annotateAdapterSupports(adaptersIn.apps),
      }
    : adaptersIn;

  const existing = Array.isArray(cfg.capabilityCandidates)
    ? (cfg.capabilityCandidates as CapabilityCandidate[])
    : [];
  const capabilityCandidates = mergeSeedCandidates(existing);

  const out: RawConfig = { ...cfg, schemaVersion: 7, capabilityCandidates };
  if (engineerRoles !== undefined) out.engineerRoles = engineerRoles;
  if (adapters !== undefined) out.adapters = adapters as Record<string, unknown>;
  return out;
}

function annotateAdapterSupports(rows: unknown): unknown {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id : '';
    const preset = BUILT_IN_ADAPTER_SUPPORTS[id];
    return preset && !Array.isArray(r.supports) ? { ...r, supports: preset } : r;
  });
}

function looksLikeReadmePath(value: string): boolean {
  return /(^|\/)README\.md$/i.test(value.trim());
}

function stringFromMetadata(metadata: unknown, key: string): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Wrapper around `crypto.randomUUID()` that falls back to a v4-shaped string
 * when the global is unavailable (older Node test envs).
 */
function generateUUID(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // RFC 4122 v4-ish fallback for environments without crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
