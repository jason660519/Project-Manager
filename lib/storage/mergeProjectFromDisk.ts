import type { ProjectManagerConfig } from '../types';
import { enrichConfigFromBundledSample } from './bundledSamples';
import { ensureEngineerRoles } from './mergeEngineerRoles';
import { mergeFeaturesById } from './mergeFeatures';
import { migrateConfig } from './migrate';

/**
 * Merge a disk-backed project config into the in-memory / localStorage copy.
 *
 * Disk is authoritative for structure, but an empty on-disk `features` array is
 * treated as an uninitialized scaffold — local features (bundled samples or
 * PM-side edits) are preserved so Tauri hydration does not wipe the dashboard.
 */
export function mergeProjectConfigFromDisk(
  localConfig: ProjectManagerConfig,
  rawDiskConfig: unknown,
  configPath: string,
): ProjectManagerConfig {
  const disk = enrichConfigFromBundledSample(
    ensureEngineerRoles(migrateConfig(rawDiskConfig)),
    configPath,
  );
  const features =
    disk.features.length > 0
      ? mergeFeaturesById(disk.features, localConfig.features)
      : localConfig.features;
  return { ...disk, features };
}
