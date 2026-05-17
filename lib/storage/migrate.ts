import type { ProjectManagerConfig, Feature } from '../types';

/**
 * Pure migration pipeline for `.project-manager.json` documents.
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

export const CURRENT_SCHEMA_VERSION = 3;

export function migrateConfig(raw: unknown): ProjectManagerConfig {
  const cfg = (raw && typeof raw === 'object' ? (raw as RawConfig) : {}) as RawConfig;
  const version = typeof cfg.schemaVersion === 'number' ? cfg.schemaVersion : 1;
  let next: RawConfig = { ...cfg };
  if (version < 2) next = migrate_1_to_2(next);
  if (version < 3) next = migrate_2_to_3(next);
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
