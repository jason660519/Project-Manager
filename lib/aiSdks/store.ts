/**
 * Persistence + validation for AI SDK parameter overrides.
 *
 * Only the user's *deltas* are stored — changed parameter values, user-added
 * custom model rows, custom categories, and per-row enabled flags. The
 * effective value of a cell is `override ?? spec.default`, computed at render
 * time against the static catalog (`./catalog`).
 *
 * Storage (per-project, non-secret):
 *   - Tauri  → `<projectRoot>/.project-manager/ai-sdks.json` via the generic
 *              read_config / write_config bridge commands (NOT migrateConfig —
 *              this file has its own schemaVersion, independent of config.json).
 *   - Browser dev (`next dev`) → localStorage, mirroring KeysContext behaviour.
 *
 * Iron Rule (zero silent failures): read failures surface as thrown errors the
 * caller can show; this module never swallows a write rejection.
 */

import { isTauriRuntime, readJsonFile, writeJsonFile } from '../bridge';
import type { LlmProviderId } from '../keys/llmProviders';
import { type ModelType, type ParamSpec, type ParamValue } from './catalog';

export const AI_SDKS_SCHEMA_VERSION = 1 as const;

const LOCAL_STORAGE_KEY = 'projectManager.aiSdks.store.v1';

export interface AiSdksModelOverride {
  /** User-chosen classification overriding the inferred default. */
  modelType?: ModelType;
  /** Sparse map of param key → user value. Absent keys fall back to spec default. */
  params?: Record<string, ParamValue>;
  /** Row include/exclude flag for downstream consumers. Defaults to true. */
  enabled?: boolean;
}

export interface AiSdksCustomModel {
  id: string;
  providerId: LlmProviderId;
  model: string;
  modelType?: ModelType;
}

export interface AiSdksConfig {
  schemaVersion: typeof AI_SDKS_SCHEMA_VERSION;
  /** Keyed by ModelCatalogEntry.id (`${providerId}:${model}`). */
  models: Record<string, AiSdksModelOverride>;
  /** User-added rows not present in the static catalog. */
  customModels: AiSdksCustomModel[];
  /** Extra classification tags beyond the built-ins. */
  customCategories: string[];
}

export function emptyAiSdksConfig(): AiSdksConfig {
  return { schemaVersion: AI_SDKS_SCHEMA_VERSION, models: {}, customModels: [], customCategories: [] };
}

export function aiSdksConfigPath(projectRoot: string): string {
  return `${projectRoot.replace(/[\\/]+$/, '')}/.project-manager/ai-sdks.json`;
}

// ── Normalization ─────────────────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeParamValue(raw: unknown): ParamValue | undefined {
  if (raw === null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' || typeof raw === 'boolean') return raw;
  return undefined;
}

/**
 * Defensive read normalizer: tolerate any shape on disk, drop unknown/invalid
 * fields, and always return a structurally-valid config. Never throws.
 */
export function normalizeStore(raw: unknown): AiSdksConfig {
  const base = emptyAiSdksConfig();
  if (!isPlainObject(raw)) return base;

  if (isPlainObject(raw.models)) {
    for (const [id, value] of Object.entries(raw.models)) {
      if (!isPlainObject(value)) continue;
      const override: AiSdksModelOverride = {};
      if (typeof value.modelType === 'string' && value.modelType.trim()) {
        override.modelType = value.modelType;
      }
      if (typeof value.enabled === 'boolean') override.enabled = value.enabled;
      if (isPlainObject(value.params)) {
        const params: Record<string, ParamValue> = {};
        for (const [k, v] of Object.entries(value.params)) {
          const nv = normalizeParamValue(v);
          if (nv !== undefined) params[k] = nv;
        }
        if (Object.keys(params).length > 0) override.params = params;
      }
      base.models[id] = override;
    }
  }

  if (Array.isArray(raw.customModels)) {
    const seen = new Set<string>();
    for (const item of raw.customModels) {
      if (!isPlainObject(item)) continue;
      const { providerId, model } = item;
      if (typeof providerId !== 'string' || typeof model !== 'string' || !model.trim()) continue;
      const id = typeof item.id === 'string' && item.id ? item.id : `${providerId}:${model}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const entry: AiSdksCustomModel = { id, providerId: providerId as LlmProviderId, model };
      if (typeof item.modelType === 'string' && item.modelType.trim()) entry.modelType = item.modelType;
      base.customModels.push(entry);
    }
  }

  if (Array.isArray(raw.customCategories)) {
    const seen = new Set<string>();
    for (const c of raw.customCategories) {
      if (typeof c !== 'string' || !c.trim() || seen.has(c)) continue;
      seen.add(c);
      base.customCategories.push(c);
    }
  }

  return base;
}

// ── Read / write ──────────────────────────────────────────────────────────────

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/**
 * Load the store. In Tauri reads `ai-sdks.json` (treating a missing file as an
 * empty store); in browser dev reads localStorage. Throws only on a genuine,
 * unexpected runtime failure so the caller can surface a recovery banner.
 */
export async function readAiSdksStore(projectRoot?: string): Promise<AiSdksConfig> {
  if (isTauriRuntime() && projectRoot) {
    try {
      const raw = await readJsonFile<unknown>(aiSdksConfigPath(projectRoot));
      return normalizeStore(raw);
    } catch (err) {
      // A missing file is the expected first-run case — treat as empty.
      const message = err instanceof Error ? err.message : String(err);
      if (/cannot read|no such file|not found|os error 2/i.test(message)) {
        return emptyAiSdksConfig();
      }
      throw new Error(`Failed to read ai-sdks.json: ${message}`);
    }
  }
  if (canUseLocalStorage()) {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return emptyAiSdksConfig();
    try {
      return normalizeStore(JSON.parse(raw));
    } catch {
      // Corrupt local cache — fall back to defaults rather than crash the view.
      return emptyAiSdksConfig();
    }
  }
  return emptyAiSdksConfig();
}

/** Persist the store. Tauri → ai-sdks.json; browser dev → localStorage. */
export async function writeAiSdksStore(store: AiSdksConfig, projectRoot?: string): Promise<void> {
  const payload: AiSdksConfig = { ...store, schemaVersion: AI_SDKS_SCHEMA_VERSION };
  if (isTauriRuntime() && projectRoot) {
    await writeJsonFile(aiSdksConfigPath(projectRoot), payload);
    return;
  }
  if (canUseLocalStorage()) {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    return;
  }
  throw new Error('writeAiSdksStore: no available persistence backend');
}

// ── Effective values + validation ─────────────────────────────────────────────

/** Resolve the value shown in a cell: user override, else the spec default. */
export function effectiveParamValue(spec: ParamSpec, override: AiSdksModelOverride | undefined): ParamValue {
  const raw = override?.params?.[spec.key];
  return raw === undefined ? spec.default : raw;
}

export interface ParamValidationResult {
  ok: boolean;
  message?: string;
  /** Coerced/clamped value to persist when out of range or wrong precision. */
  clamped?: ParamValue;
}

/**
 * Validate (and optionally clamp) a value against its spec. Empty string maps
 * to null (unset) for non-string params. Range violations clamp; type/enum
 * violations are reported without a clamp.
 */
export function validateParam(spec: ParamSpec, value: ParamValue): ParamValidationResult {
  // Empty / unset.
  if (value === null || value === '') {
    if (spec.type === 'string') return { ok: true };
    return { ok: true, clamped: null };
  }

  switch (spec.type) {
    case 'boolean':
      return typeof value === 'boolean'
        ? { ok: true }
        : { ok: false, message: 'Must be true or false.' };

    case 'enum': {
      const ok = typeof value === 'string' && (spec.enumValues ?? []).includes(value);
      return ok ? { ok: true } : { ok: false, message: `Must be one of: ${(spec.enumValues ?? []).join(', ')}.` };
    }

    case 'string':
      return typeof value === 'string' ? { ok: true } : { ok: false, message: 'Must be text.' };

    case 'number':
    case 'integer': {
      const num = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(num)) return { ok: false, message: 'Must be a number.' };
      if (spec.type === 'integer' && !Number.isInteger(num)) {
        return { ok: false, message: 'Must be a whole number.', clamped: Math.round(num) };
      }
      if (spec.min !== undefined && num < spec.min) {
        return { ok: false, message: `Minimum is ${spec.min}.`, clamped: spec.min };
      }
      if (spec.max !== undefined && num > spec.max) {
        return { ok: false, message: `Maximum is ${spec.max}.`, clamped: spec.max };
      }
      return { ok: true };
    }

    default:
      return { ok: true };
  }
}
