import type { Feature } from '../types';

/**
 * User-editable fields that survive a sync. Anything outside this set is
 * taken straight from the remote (disk / GitHub) version, because the remote
 * is the source of truth for structure (id, name, category, paths…).
 */
const PRESERVED_KEYS = ['status', 'progress', 'notes'] as const;

/**
 * Merge remote features (from `.project-manager.json` on disk or from GitHub)
 * with local features (currently held in PM memory + LocalStorage).
 *
 * Rules:
 *   - Remote is the structural skeleton — id / name / category / paths win.
 *   - For features matched by id, the local PM-side edits
 *     (status, progress, notes) overlay onto the remote shape.
 *   - Remote features not present locally are kept as-is (new work appeared on disk).
 *   - Local features not present in remote are dropped (they were removed upstream).
 */
export function mergeFeaturesById(remote: Feature[], local: Feature[]): Feature[] {
  const localById = new Map(local.map((f) => [f.id, f]));
  return remote.map((remoteFeature) => {
    const localFeature = localById.get(remoteFeature.id);
    if (!localFeature) return remoteFeature;
    const merged: Feature = { ...remoteFeature };
    for (const key of PRESERVED_KEYS) {
      const localValue = localFeature[key];
      if (localValue !== undefined) {
        // Cast through unknown so TS accepts the heterogeneous union of
        // string | number | undefined across PRESERVED_KEYS.
        (merged as unknown as Record<string, unknown>)[key] = localValue;
      }
    }
    return merged;
  });
}
