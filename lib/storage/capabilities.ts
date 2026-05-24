/**
 * Capability candidate catalog storage (schema v7, F23).
 *
 * Mirrors the plugin-catalog persistence pattern: localStorage-backed,
 * accessed through `loadCapabilityCatalog()` / `saveCapabilityCatalog()`.
 * State-machine events go through `applyCandidateEvent` so transitions are
 * always validated by `lib/capabilities/state-machine.ts`.
 */
import type { CapabilityCandidate } from '../types';
import type { CandidateSheet } from '../types';
import { mergeSeedCandidates } from '../capabilities/registry';
import { transition, type CandidateEvent } from '../capabilities/state-machine';
import { KEY_SHARED_CAPABILITIES } from './keys';

export interface CapabilityCatalog {
  schemaVersion: 1;
  candidates: CapabilityCandidate[];
}

const DEFAULT_CATALOG: CapabilityCatalog = { schemaVersion: 1, candidates: [] };

function readJSON<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded — ignore */
  }
}

/** Loads the catalog, seeding built-in candidates on first run (and adding any new built-ins that have shipped since). */
export function loadCapabilityCatalog(): CapabilityCatalog {
  const raw = readJSON<CapabilityCatalog>(KEY_SHARED_CAPABILITIES);
  if (!raw || !Array.isArray(raw.candidates)) {
    const fresh: CapabilityCatalog = { schemaVersion: 1, candidates: mergeSeedCandidates([]) };
    writeJSON(KEY_SHARED_CAPABILITIES, fresh);
    return fresh;
  }
  const merged = mergeSeedCandidates(raw.candidates);
  if (merged.length !== raw.candidates.length) {
    const upgraded: CapabilityCatalog = { schemaVersion: 1, candidates: merged };
    writeJSON(KEY_SHARED_CAPABILITIES, upgraded);
    return upgraded;
  }
  return raw;
}

export function saveCapabilityCatalog(catalog: CapabilityCatalog): void {
  writeJSON(KEY_SHARED_CAPABILITIES, catalog);
}

/** Apply a state-machine event to one candidate id and persist the catalog. */
export function applyCandidateEvent(
  catalog: CapabilityCatalog,
  candidateId: string,
  event: CandidateEvent,
): CapabilityCatalog {
  const candidates = catalog.candidates.map((c) => {
    if (c.id !== candidateId) return c;
    const next = transition(c, event);
    return { ...c, ...next };
  });
  const out: CapabilityCatalog = { schemaVersion: 1, candidates };
  writeJSON(KEY_SHARED_CAPABILITIES, out);
  return out;
}

export function findCandidate(catalog: CapabilityCatalog, id: string): CapabilityCandidate | null {
  return catalog.candidates.find((c) => c.id === id) ?? null;
}

/** All candidates whose state is `passed` — used by the Engineers role form. */
export function listPassedCandidates(
  catalog: CapabilityCatalog,
  sheet?: CandidateSheet,
): CapabilityCandidate[] {
  return catalog.candidates.filter(
    (c) => c.state === 'passed' && (sheet === undefined || c.sheet === sheet),
  );
}

export { DEFAULT_CATALOG };
