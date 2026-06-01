/**
 * Static reference data for the AI SDKs view: model classification tags and
 * the tunable request parameters each provider's SDK exposes.
 *
 * Source of truth for *providers* and *model ids* is `lib/keys/llmProviders.ts`
 * — we never duplicate that list. This module layers two things on top:
 *   1. `PARAM_CATALOGS` — the columns each provider sheet renders, keyed by the
 *      provider's `apiKind` (anthropic / gemini / openai-compatible), since the
 *      tunable parameter surface is determined by the wire protocol.
 *   2. `buildModelCatalog()` — flattens every provider's `availableModels` into
 *      one row per model with a stable, globally-unique id.
 *
 * Server-safe (no `'use client'`, no window/bridge access) so route components
 * and tests can import it freely.
 */

import {
  listLlmProviders,
  type LlmApiKind,
  type LlmProviderId,
  type LlmProviderSpec,
} from '../keys/llmProviders';
import { modelRowId } from './uuid';

/** Built-in model classification tags. Users may add custom categories on top. */
export const DEFAULT_MODEL_TYPES = ['LLM', 'VLM', 'Coding Agent'] as const;
export type ModelType = string; // open union: built-ins above + user-defined

export type ParamValueType = 'number' | 'integer' | 'boolean' | 'enum' | 'string';
export type ParamValue = number | string | boolean | null;

export interface ParamSpec {
  /** Stable key — also the persisted override key and the `col-param-<key>` id suffix. */
  key: string;
  label: string;
  type: ParamValueType;
  /** Inclusive bounds for number/integer types. */
  min?: number;
  max?: number;
  step?: number;
  /** Allowed values for enum type. */
  enumValues?: readonly string[];
  default: ParamValue;
  /** Unit shown in the column header, e.g. 'tokens'. */
  unit?: string;
  description: string;
}

export interface ModelCatalogEntry {
  /** Stable UUIDv5 (col-id) derived from `naturalKey` — the future DB primary key. */
  id: string;
  /** Human-readable natural key `${providerId}:${model}` the UUID is derived from. */
  naturalKey: string;
  providerId: LlmProviderId;
  /** Provider official full name (from the registry label). */
  providerLabel: string;
  /** Model identifier as accepted by the provider API. */
  model: string;
  /** Default classification inferred from the model id; user-overridable. */
  modelType: ModelType;
}

// ── Parameter catalogs, keyed by wire protocol ────────────────────────────────
// Values follow each provider's published defaults. Where a provider deviates
// (e.g. Anthropic caps temperature at 1.0 while OpenAI allows 2.0) the bounds
// reflect that provider's documented range.

const ANTHROPIC_PARAMS: ParamSpec[] = [
  { key: 'max_tokens', label: 'Max Tokens', type: 'integer', min: 1, max: 200000, step: 1, default: 4096, unit: 'tokens', description: 'Maximum number of tokens to generate before stopping.' },
  { key: 'temperature', label: 'Temperature', type: 'number', min: 0, max: 1, step: 0.1, default: 1.0, description: 'Randomness of sampling. Lower is more deterministic. Anthropic range 0–1.' },
  { key: 'top_p', label: 'Top P', type: 'number', min: 0, max: 1, step: 0.05, default: 1.0, description: 'Nucleus sampling: consider tokens with top_p cumulative probability. Use either temperature or top_p, not both.' },
  { key: 'top_k', label: 'Top K', type: 'integer', min: 0, max: 500, step: 1, default: 0, description: 'Only sample from the top K options for each token. 0 disables.' },
  { key: 'stop_sequences', label: 'Stop Sequences', type: 'string', default: '', description: 'Comma-separated sequences that will cause the model to stop generating.' },
];

const OPENAI_PARAMS: ParamSpec[] = [
  { key: 'max_tokens', label: 'Max Tokens', type: 'integer', min: 1, max: 128000, step: 1, default: 1024, unit: 'tokens', description: 'Maximum number of tokens to generate in the completion.' },
  { key: 'temperature', label: 'Temperature', type: 'number', min: 0, max: 2, step: 0.1, default: 1.0, description: 'Sampling temperature. Higher is more random. OpenAI-compatible range 0–2.' },
  { key: 'top_p', label: 'Top P', type: 'number', min: 0, max: 1, step: 0.05, default: 1.0, description: 'Nucleus sampling probability mass. Alternative to temperature.' },
  { key: 'frequency_penalty', label: 'Frequency Penalty', type: 'number', min: -2, max: 2, step: 0.1, default: 0, description: 'Penalises new tokens by their existing frequency, reducing repetition.' },
  { key: 'presence_penalty', label: 'Presence Penalty', type: 'number', min: -2, max: 2, step: 0.1, default: 0, description: 'Penalises new tokens by whether they appear so far, encouraging new topics.' },
  { key: 'seed', label: 'Seed', type: 'integer', min: 0, step: 1, default: null, description: 'Best-effort deterministic sampling for a fixed seed. Leave empty to disable.' },
  { key: 'stop', label: 'Stop', type: 'string', default: '', description: 'Comma-separated sequences where the API stops generating further tokens.' },
];

const GEMINI_PARAMS: ParamSpec[] = [
  { key: 'maxOutputTokens', label: 'Max Output Tokens', type: 'integer', min: 1, max: 65536, step: 1, default: 8192, unit: 'tokens', description: 'Maximum number of tokens to generate in the response.' },
  { key: 'temperature', label: 'Temperature', type: 'number', min: 0, max: 2, step: 0.1, default: 1.0, description: 'Controls randomness. Gemini range 0–2.' },
  { key: 'topP', label: 'Top P', type: 'number', min: 0, max: 1, step: 0.05, default: 0.95, description: 'Nucleus sampling cumulative probability.' },
  { key: 'topK', label: 'Top K', type: 'integer', min: 1, max: 1000, step: 1, default: 40, description: 'Sample from the top K most probable tokens.' },
  { key: 'candidateCount', label: 'Candidate Count', type: 'integer', min: 1, max: 8, step: 1, default: 1, description: 'Number of response candidates to generate.' },
  { key: 'stopSequences', label: 'Stop Sequences', type: 'string', default: '', description: 'Comma-separated sequences that stop generation.' },
];

const PARAMS_BY_API_KIND: Record<LlmApiKind, ParamSpec[]> = {
  anthropic: ANTHROPIC_PARAMS,
  gemini: GEMINI_PARAMS,
  'openai-compatible': OPENAI_PARAMS,
};

/** Parameter columns for a given provider, by id. */
export function getParamSpecs(providerId: LlmProviderId): ParamSpec[] {
  const provider = listLlmProviders().find((p) => p.id === providerId);
  if (!provider) return [];
  return PARAMS_BY_API_KIND[provider.apiKind] ?? [];
}

/**
 * Heuristic default classification from the model id. Users can override per
 * row; this only seeds a sensible starting value. Image/vision models → VLM;
 * coding-oriented model families → Coding Agent; everything else → LLM.
 */
export function inferModelType(model: string): ModelType {
  const m = model.toLowerCase();
  if (/(image|vision|-vl\b|vl-|gemini-.*image|gpt-image)/.test(m)) return 'VLM';
  if (/(code|coder|coding)/.test(m)) return 'Coding Agent';
  return 'LLM';
}

function buildEntriesForProvider(provider: LlmProviderSpec): ModelCatalogEntry[] {
  return provider.availableModels.map((model) => ({
    id: modelRowId(provider.id, model),
    naturalKey: `${provider.id}:${model}`,
    providerId: provider.id,
    providerLabel: provider.label,
    model,
    modelType: inferModelType(model),
  }));
}

/** Every catalog model as a flat row list (all providers). */
export function buildModelCatalog(): ModelCatalogEntry[] {
  return listLlmProviders().flatMap(buildEntriesForProvider);
}

/** Catalog rows for a single provider sheet. */
export function buildProviderModelCatalog(providerId: LlmProviderId): ModelCatalogEntry[] {
  const provider = listLlmProviders().find((p) => p.id === providerId);
  return provider ? buildEntriesForProvider(provider) : [];
}
