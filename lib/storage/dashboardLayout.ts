/**
 * Path helpers for the consolidated `.project-manager/` dashboard layout
 * (ADR-008). The whole filesystem footprint per project is:
 *
 *   <root>/.project-manager/
 *     config.json
 *     features/
 *     dev-logs/
 *
 * These functions normalise the four kinds of input we accept from users and
 * from already-stored `ProjectEntry.configPath` values:
 *
 *   1. plain folder              "/foo/bar"
 *   2. dashboard dir             "/foo/bar/.project-manager"
 *   3. new canonical config      "/foo/bar/.project-manager/config.json"
 *   4. legacy single-file config "/foo/bar/.project-manager.json"
 *
 * They all collapse to the same project root, so the rest of the codebase can
 * treat `configPath` as opaque.
 */

export const DASHBOARD_DIR_NAME = '.project-manager';
export const CONFIG_FILENAME = 'config.json';
export const LEGACY_CONFIG_FILENAME = '.project-manager.json';

export const NEW_CONFIG_REL_PATH = `${DASHBOARD_DIR_NAME}/${CONFIG_FILENAME}`;

/** Strip trailing slashes and surrounding whitespace. */
function tidy(input: string): string {
  return input.trim().replace(/\/+$/, '');
}

/**
 * Reduce any accepted input form to the project root (the directory that
 * contains `.project-manager/`). Returns `''` for an empty/whitespace-only
 * input so callers can detect "no project root yet".
 */
export function resolveProjectRoot(input: string): string {
  const trimmed = tidy(input);
  if (!trimmed) return '';
  if (trimmed.endsWith(`/${NEW_CONFIG_REL_PATH}`)) {
    return trimmed.slice(0, -NEW_CONFIG_REL_PATH.length - 1);
  }
  if (trimmed.endsWith(`/${DASHBOARD_DIR_NAME}`)) {
    return trimmed.slice(0, -DASHBOARD_DIR_NAME.length - 1);
  }
  if (trimmed.endsWith(`/${LEGACY_CONFIG_FILENAME}`)) {
    return trimmed.slice(0, -LEGACY_CONFIG_FILENAME.length - 1);
  }
  return trimmed;
}

/** Absolute path to the dashboard folder for a given project. */
export function resolveDashboardDir(input: string): string {
  const root = resolveProjectRoot(input);
  return `${root}/${DASHBOARD_DIR_NAME}`;
}

/** Absolute path to the *legacy* single-file config, for migration fallbacks. */
export function resolveLegacyConfigPath(input: string): string {
  const root = resolveProjectRoot(input);
  return `${root}/${LEGACY_CONFIG_FILENAME}`;
}

/** Absolute path to the dashboard's features directory (spec docs land here). */
export function resolveFeaturesDir(input: string): string {
  return `${resolveDashboardDir(input)}/features`;
}

/** Absolute path to the daily dev-logs directory. */
export function resolveDevLogsDir(input: string): string {
  return `${resolveDashboardDir(input)}/dev-logs`;
}

export type StorageLayout = 'new' | 'legacy' | 'missing';

/**
 * Inspect the on-disk layout of a project. The `probe` is an existence check
 * that returns true if the given absolute path exists — in production this is
 * a thin Tauri bridge call, but the function itself stays pure so it is easy
 * to unit-test.
 *
 * Resolution order:
 *   1. <root>/.project-manager/config.json  → "new"
 *   2. <root>/.project-manager.json         → "legacy"
 *   3. otherwise                            → "missing"
 *
 * When both exist (e.g. a partial migration), "new" wins so the dashboard
 * never silently regresses to stale data.
 */
export function detectStorageLayout(
  input: string,
  probe: (absPath: string) => boolean,
): StorageLayout {
  const root = resolveProjectRoot(input);
  if (probe(`${root}/${NEW_CONFIG_REL_PATH}`)) return 'new';
  if (probe(`${root}/${LEGACY_CONFIG_FILENAME}`)) return 'legacy';
  return 'missing';
}
